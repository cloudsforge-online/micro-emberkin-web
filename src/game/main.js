// KINDRED: Resonance — web game entry + state machine.
// Wires the ported engine (engine/*) to the 3D stage (render/*) and DOM UI (ui/*).

import * as THREE from "three";
import { GameData } from "./engine/data.js";
import { Rng } from "./engine/rng.js";
import { Kin } from "./engine/kin.js";
import { Party } from "./engine/party.js";
import { BattleEngine, BattleSide } from "./engine/battle.js";
import { Items } from "./engine/items.js";
import { saveGame, loadGame, hasSave } from "./engine/save.js";
import { Stage, SLOTS } from "./render/scene.js";
import { createCreature } from "./render/creatures.js";
import { AssetLibrary } from "./render/assets.js";
import { preloadProps } from "./render/environments.js";
import { Vfx } from "./render/effects.js";

const CREATURE_URL = "../assets/models/creatures/";
import { TitleScreen, StarterSelect, Dialogue, BattleHUD, Toast, RegionMap, PartyScreen, HUD, BagScreen } from "./ui/ui.js";

const UP = new THREE.Vector3(0, 1.1, 0);
const wait = ms => new Promise(r => setTimeout(r, ms));
const prettify = id => id.split("_").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");

export async function boot() {
  const data = await GameData.load("../data");
  const canvas = document.getElementById("glcanvas");
  const uiRoot = document.getElementById("ui");
  const game = new Game(data, canvas, uiRoot);
  await game.preload();
  await game.init();
  document.getElementById("loading").style.display = "none";
  await game.run();
}

class Game {
  constructor(data, canvas, uiRoot) {
    this.data = data;
    this.stage = new Stage(canvas);
    this.vfx = new Vfx(THREE, this.stage.scene);
    this.ui = {
      title: new TitleScreen(uiRoot), starter: new StarterSelect(uiRoot),
      dialogue: new Dialogue(uiRoot), hud: new BattleHUD(uiRoot),
      toast: new Toast(uiRoot), map: new RegionMap(uiRoot), party: new PartyScreen(uiRoot),
      bag: new BagScreen(uiRoot), overworld: new HUD(uiRoot),
    };
    this._bindOverworldMenu();
    this.showcase = [];
    this.rng = new Rng(20260722n);
    this.state = null;
    this.assets = new AssetLibrary(THREE);
  }

  // Load every species model up front (with textures) so spawns are instant.
  async preload() {
    const ids = [...this.data.species.keys()];
    const loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.firstChild && (loadingEl.firstChild.textContent = "LOADING ASSETS");
    await Promise.all([this.assets.preloadCreatures(ids, CREATURE_URL), preloadProps()]);
  }

  // Build a creature rig from a preloaded model. Falls back gracefully if a
  // model is missing (skips rather than crashing the flow).
  makeRig(species) {
    const scene = this.assets.getCreatureScene(species.id);
    if (!scene) return null;
    return createCreature(THREE, species, this.data.visual(species.id), scene);
  }

  async init() {
    this.stage.setBiome("lumen_core");
    // Showcase the mascot behind the title.
    const hero = this.makeRig(this.data.getSpecies("aetherion"));
    if (hero) {
      hero.group.position.set(0, 0, -1);
      this.stage.scene.add(hero.group);
      this.showcase.push(hero);
    }
    this._loop();
  }

  _loop() {
    let last = performance.now();
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.stage.update(dt);
      this.vfx.update(dt);
      for (const r of this.showcase) { r.update(dt); r.group.rotation.y += dt * 0.5; }
      this.stage.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  clearShowcase() {
    for (const r of this.showcase) { this.stage.scene.remove(r.group); r.dispose?.(); }
    this.showcase = [];
  }

  newState(wardenName = "Warden") {
    return {
      wardenName,
      party: new Party(), box: [],
      bag: { potion: 5, super_potion: 2, salve: 2, resonator: 10, greater_resonator: 3 },
      seals: new Set(), seen: new Set(),
      currentRegion: this.data.campaign.startRegion, storyProgress: 0,
    };
  }

  // ---------------- Top-level flow ----------------

  async run() {
    const choice = await this.ui.title.show({ hasSave: hasSave() });
    this.clearShowcase();

    if (choice === "continue") {
      const loaded = loadGame(this.data);
      if (loaded) {
        this.state = Object.assign(this.newState(), loaded);
        if (!(this.state.party instanceof Party)) {
          const p = new Party(); loaded.party.forEach(k => p.add(k)); this.state.party = p;
        }
      } else this.state = this.newState();
    } else {
      this.state = this.newState();
    }

    const story = this.data.campaign.story;
    while (this.state.storyProgress < story.length) {
      const beat = story[this.state.storyProgress];
      await this.playBeat(beat);
      this.state.storyProgress++;
      saveGame(this.state);
      if (this.state.storyProgress < story.length) {
        await this.interlude();
      }
    }
    this.ui.overworld.hide();
    await this.ui.dialogue.say("", "★ You have mended the world. Thank you for playing KINDRED: Resonance. ★");
  }

  async playBeat(beat) {
    if (beat.region && beat.region !== this.state.currentRegion) this.state.currentRegion = beat.region;
    this.setSceneForRegion();

    if (beat.text) await this.ui.dialogue.say(beat.speaker || "", beat.text);
    if (beat.grantsStarter && this.state.party.isEmpty) await this.chooseStarter();
    if (beat.battle) await this.runStoryBattle(beat.battle);
  }

  setSceneForRegion() {
    this.stage.setBiome(this.state.currentRegion);
    this.clearShowcase();
    if (!this.state.party.isEmpty) {
      const lead = this.state.party.members[this.state.party.firstHealthyIndex() >= 0 ? this.state.party.firstHealthyIndex() : 0];
      const rig = this.makeRig(lead.species);
      if (rig) {
        rig.group.position.copy(SLOTS.player);
        rig.faceToward(new THREE.Vector3(0, 0, 0));
        this.stage.scene.add(rig.group);
        this.showcase.push(rig);
      }
    }
    // Reflect overworld state whenever we (re)enter a region with a party.
    if (this.state && !this.state.party.isEmpty) {
      this.ui.overworld.update(this._hudState());
      this.ui.overworld.show();
    } else {
      this.ui.overworld.hide();
    }
  }

  async chooseStarter() {
    const starters = this.data.campaign.starters.map(id => this.data.getSpecies(id));
    // Show the three starters in 3D behind the cards.
    this.clearShowcase();
    starters.forEach((s, i) => {
      const rig = this.makeRig(s);
      if (!rig) return;
      rig.group.position.set((i - 1) * 2.2, 0, -1.5);
      this.stage.scene.add(rig.group);
      this.showcase.push(rig);
    });
    const chosenId = await this.ui.starter.choose(starters.map(s => ({ id: s.id, name: s.name, types: s.types, lore: s.lore })));
    this.clearShowcase();
    const kin = Kin.create(this.data.getSpecies(chosenId), 5, this.rng);
    this.state.party.add(kin);
    this.ui.toast.show(`${kin.nickname} joins you!`);
    this.setSceneForRegion();
  }

  // ---------------- Overworld (continuous story + side menu) ----------------

  _bagList() {
    return Object.entries(this.state.bag)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ id, name: Items.displayName(id), count: n }));
  }

  _hudState() {
    const region = this.data.campaign.regions.find(r => r.id === this.state.currentRegion);
    return {
      regionName: region ? region.name : prettify(this.state.currentRegion),
      party: this.state.party.members,
      seals: this.state.seals.size,
      canExplore: !!(region && region.wildKin && region.wildKin.length),
    };
  }

  // Wire the persistent side-menu buttons once. Callbacks read live state.
  _bindOverworldMenu() {
    this.ui.overworld.bind({
      onParty: () => this.ui.party.show(this.state.party.members),
      onBag: () => this.ui.bag.show(this._bagList()),
      onSave: () => { saveGame(this.state); this.ui.toast.show("Game saved."); },
      onExplore: async () => {
        const region = this.data.campaign.regions.find(r => r.id === this.state.currentRegion);
        if (!region || !region.wildKin || !region.wildKin.length) {
          this.ui.toast.show("The area is quiet."); return;
        }
        await this.explore();
        this.setSceneForRegion();
        this.ui.overworld.show();
      },
    });
  }

  // Between story beats: stand in the region with the side menu available and
  // a Continue prompt to advance the story.
  async interlude() {
    this.setSceneForRegion();
    const next = this.data.campaign.story[this.state.storyProgress];
    this.ui.overworld.update(this._hudState());
    this.ui.overworld.show();
    await this.ui.overworld.interlude({
      nextBeat: next ? (next.speaker ? `${next.speaker}…` : "Continue the story") : "Finale",
    });
  }

  async explore() {
    const region = this.data.campaign.regions.find(r => r.id === this.state.currentRegion);
    if (!region || !region.wildKin.length) { this.ui.toast.show("The area is quiet."); return; }
    const pick = this.rng.weighted(region.wildKin, w => w.weight);
    const lvl = pick.levels.length >= 2 ? this.rng.range(pick.levels[0], pick.levels[1]) : 5;
    const wild = Kin.createWild(this.data.getSpecies(pick.species), lvl, this.rng);
    const ep = new Party(); ep.add(wild);
    this.state.seen.add(wild.species.id);
    await this.battle(ep, "Wild", true);
  }

  // ---------------- Battles ----------------

  async runStoryBattle(battleId) {
    const warden = this.data.campaign.sealWardens.find(w => w.id === battleId);
    const team = new Party();
    let name;
    if (warden) {
      name = warden.name;
      warden.team.forEach(t => team.add(Kin.create(this.data.getSpecies(t.species), t.level, this.rng, 55, 20)));
    } else if (this.data.species.has(battleId)) {
      name = this.data.getSpecies(battleId).name;
      const lvl = 20 + this.state.seals.size * 6;
      team.add(Kin.create(this.data.getSpecies(battleId), lvl, this.rng, 70, 40));
    } else {
      name = prettify(battleId);
      const lvl = 16 + this.state.seals.size * 5;
      ["umbrawulf", "nocthound", "shadepup"].slice(0, 1 + Math.floor(this.state.seals.size / 3) + 1)
        .forEach(sp => { if (this.data.species.has(sp)) team.add(Kin.create(this.data.getSpecies(sp), lvl, this.rng, 60, 50)); });
      if (team.isEmpty) team.add(Kin.create(this.data.getSpecies("umbrawulf"), lvl, this.rng));
    }
    if (this.state.party.isEmpty) return;
    await this.ui.dialogue.say("", `⚔ ${name} challenges you!`);
    const outcome = await this.battle(team, name, false);
    if (outcome === "PlayerWin" && warden && warden.reward) {
      this.state.seals.add(warden.reward);
      this.ui.toast.show(`You earned the ${prettify(warden.reward)}!`, 2600);
    }
  }

  async battle(enemyParty, enemyName, wild) {
    const player = this.state.party;
    const hi = player.firstHealthyIndex(); if (hi >= 0) player.activeIndex = hi;

    this.clearShowcase();
    this.ui.overworld.hide();
    this.stage.clearRigs();
    this.rebuildRig("player", player.active);
    this.rebuildRig("enemy", enemyParty.active);
    this.stage.frameCamera("player", "enemy");

    const pSide = new BattleSide(player, this.state.wardenName, true);
    const eSide = new BattleSide(enemyParty, enemyName, false, wild);
    this._pending = [];
    const engine = new BattleEngine(this.data, this.rng, pSide, eSide, {
      log: t => this.ui.hud.log(t),
      anim: e => this._pending.push(e),
    });

    this.ui.hud.setActors(player.active, enemyParty.active);
    engine.start();
    await this.playAnim(engine);

    let guard = 0;
    while (engine.outcome === "Ongoing" && guard++ < 300) {
      const k = player.active;
      const moves = engine.availableMoves(k).map(m => ({
        id: m.id, name: m.name, type: m.type, category: m.category, power: m.power,
        accuracy: m.accuracy, isResonanceArt: m.isResonanceArt, syncCost: m.syncCost,
        ready: !m.isResonanceArt || k.canUseArt(m),
      }));
      const bag = Object.entries(this.state.bag).filter(([, n]) => n > 0)
        .map(([id, n]) => ({ id, name: Items.displayName(id), count: n }));
      const action = await this.ui.hud.chooseAction({
        moves, canCatch: wild, canFlee: wild, party: player.members, bag,
      });
      if ((action.kind === "item" || action.kind === "catch") && action.itemId) {
        if (this.state.bag[action.itemId] > 0) this.state.bag[action.itemId]--;
      }
      this._pending = [];
      engine.executeTurn(action);
      await this.playAnim(engine);
      this.ui.hud.refresh();
    }

    const outcome = engine.outcome;
    if (outcome === "PlayerWin") { await wait(300); this.grantRewards(enemyParty); }
    else if (outcome === "EnemyWin") { player.healAll(); this.ui.toast.show("Your Kin are exhausted. You retreat and recover…", 2600); }
    else if (outcome === "Caught") this.addCaught(enemyParty.active);

    player.resetBattleState();
    this.ui.hud.hide();
    this.stage.clearRigs();
    this.setSceneForRegion();
    return outcome;
  }

  rebuildRig(slot, kin) {
    this.stage.clearRig(slot);
    const rig = this.makeRig(kin.species);
    if (rig) this.stage.mountRig(rig, slot);
  }

  async playAnim(engine) {
    const events = this._pending; this._pending = [];
    for (const e of events) {
      const rigs = this.stage.rigs;
      if (e.kind === "move") {
        const from = SLOTS[e.side].clone().add(UP);
        const toSlot = e.side === "player" ? "enemy" : "player";
        const to = SLOTS[toSlot].clone().add(UP);
        rigs[e.side]?.faceToward(SLOTS[toSlot]);
        if (e.isArt) { await new Promise(res => rigs[e.side]?.playCast(res) ?? res()); this.stage.shake(0.25); }
        const dur = this.vfx.cast({ element: e.element, from, to, isArt: e.isArt, category: e.category }, () => {});
        rigs[e.side]?.playAttack(to, () => {});
        await wait((dur || 0.35) * 1000);
      } else if (e.kind === "hit") {
        rigs[e.side]?.playHit();
        this.vfx.impact({ element: e.element, at: SLOTS[e.side].clone().add(UP), crit: e.crit });
        this.stage.shake(e.crit ? 0.7 : 0.25);
        this.ui.hud.refresh();
        await wait(180);
      } else if (e.kind === "status") {
        this.vfx.statusAura?.(rigs[e.side], e.status);
        this.ui.hud.refresh();
        await wait(140);
      } else if (e.kind === "faint") {
        rigs[e.side]?.playFaint();
        await wait(650);
      } else if (e.kind === "switchIn") {
        const kin = e.side === "player" ? engine.player.active : engine.enemy.active;
        this.rebuildRig(e.side, kin);
        this.ui.hud.setActors(engine.player.active, engine.enemy.active);
        await wait(250);
      } else if (e.kind === "catch") {
        await wait(e.shakes * 300 + 350);
      }
    }
  }

  grantRewards(defeated) {
    const avg = Math.round(defeated.members.reduce((a, k) => a + k.level, 0) / defeated.members.length);
    const xp = Math.max(10, avg * 9);
    for (const k of this.state.party.members.filter(k => !k.isFainted)) {
      const learned = k.gainXp(xp);
      if (learned.length) this.ui.toast.show(`${k.nickname} learned ${learned.map(m => this.data.move(m).name).join(", ")}!`);
    }
    this.checkEvolutions();
  }

  async checkEvolutions() {
    for (const k of [...this.state.party.members]) {
      const into = k.checkEvolution(this.state.currentRegion);
      if (!into) continue;
      const before = k.nickname;
      k.evolveInto(this.data.getSpecies(into));
      await this.ui.dialogue.say("", `✦ What? ${before} is evolving… it became ${k.nickname}!`);
    }
  }

  addCaught(caught) {
    if (this.state.party.add(caught)) this.ui.toast.show(`${caught.nickname} joined your party!`, 2400);
    else { this.state.box.push(caught); this.ui.toast.show(`${caught.nickname} was sent to the Aviary.`, 2400); }
  }
}
