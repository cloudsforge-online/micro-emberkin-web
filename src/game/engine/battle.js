// Turn-based battle engine. Port of Kindred.Core.Battle.BattleEngine.
// Emits text via `log(text)` (for the HUD) and structured `anim(evt)` events
// (for the 3D renderer to drive attack lunges, VFX, camera, faints).

import { Items, Catching } from "./items.js";

export class BattleSide {
  constructor(party, name, isPlayer, isWild = false) {
    this.party = party; this.name = name; this.isPlayer = isPlayer; this.isWild = isWild;
  }
  get active() { return this.party.active; }
}

export const STAB = 1.2;
const CRIT_MULT = 1.5;

export function computeDamage(attacker, defender, move, data, rng) {
  if (move.category === "status" || move.power <= 0)
    return { damage: 0, typeMult: 1, crit: false };
  const typeMult = data.typeMultiplier(move.type, defender.types);
  if (typeMult === 0) return { damage: 0, typeMult: 0, crit: false };

  const physical = move.category === "physical";
  const atk = attacker.effectiveStat(physical ? "attack" : "spatk");
  const def = Math.max(1, defender.effectiveStat(physical ? "defense" : "spdef"));
  let base = Math.floor((2 * attacker.level / 5 + 2) * move.power * atk / def / 50) + 2;

  const stab = attacker.types.includes(move.type) ? STAB : 1.0;
  const reso = 1 + attacker.resonance / 500;
  const crit = rng.next(16) === 0;
  const critMult = crit ? CRIT_MULT : 1.0;
  const rand = rng.range(85, 100) / 100;
  const dmg = Math.floor(base * stab * typeMult * reso * critMult * rand);
  return { damage: Math.max(1, dmg), typeMult, crit };
}

export class BattleEngine {
  constructor(data, rng, player, enemy, { log = () => {}, anim = () => {} } = {}) {
    this.data = data; this.rng = rng; this.player = player; this.enemy = enemy;
    this._log = log; this._anim = anim;
    this.outcome = "Ongoing";
    this.turn = 0;
  }

  start() {
    this.player.party.resetBattleState();
    this.enemy.party.resetBattleState();
    this._log(this.enemy.isWild ? `A wild ${this.enemy.active.nickname} appears!`
      : `${this.enemy.name} sends out ${this.enemy.active.nickname}!`);
    this._log(`Go, ${this.player.active.nickname}!`);
    this._anim({ kind: "intro" });
  }

  availableMoves(kin) {
    const moves = kin.moves.map(id => this.data.move(id));
    const art = kin.species.resonanceArt;
    if (kin.isResonant && art && this.data.moves.has(art)) moves.push(this.data.move(art));
    return moves;
  }

  executeTurn(action) {
    if (this.outcome !== "Ongoing") return;
    this.turn++;
    const enemyAction = this._chooseEnemyAction();

    if (action.kind === "flee") { if (this._tryFlee()) { this.outcome = "Fled"; return; } }
    if (action.kind === "catch") { this._resolveCatch(action.itemId || "resonator"); if (this.outcome !== "Ongoing") return; }
    this._resolveNonMove(this.player, action);
    this._resolveNonMove(this.enemy, enemyAction);

    const actors = [];
    if (action.kind === "move") actors.push([this.player, action]);
    if (enemyAction.kind === "move") actors.push([this.enemy, enemyAction]);
    actors.sort((a, b) => this._order(b) - this._order(a));

    for (const [side, act] of actors) {
      if (this.outcome !== "Ongoing") break;
      if (side.active.isFainted) continue;
      this._performMove(side, this._other(side), act.moveId);
      this._resolveFaints();
    }
    if (this.outcome !== "Ongoing") return;

    this._endOfTurn(this.player.active);
    this._endOfTurn(this.enemy.active);
    this._resolveFaints();
  }

  _order([side, act]) {
    const m = this.data.move(act.moveId);
    return m.priority * 10000 + side.active.effectiveStat("speed");
  }
  _other(s) { return s === this.player ? this.enemy : this.player; }
  _sideName(s) { return s === this.player ? "player" : "enemy"; }

  _resolveNonMove(side, act) {
    if (act.kind === "switch") {
      if (side.active.status === "Root") { this._log(`${side.active.nickname} is rooted and can't switch!`); return; }
      const prev = side.active.nickname;
      if (side.party.switchTo(act.switchIndex)) {
        this._log(`${side.name} withdrew ${prev} and sent out ${side.active.nickname}!`);
        this._anim({ kind: "switchIn", side: this._sideName(side) });
      }
    } else if (act.kind === "item") {
      this._useItem(side, act.itemId || "");
    }
  }

  _useItem(side, itemId) {
    const kin = side.active;
    const heal = Items.healAmount(itemId);
    if (heal > 0) {
      const done = kin.heal(heal);
      this._log(`${side.name} used ${Items.displayName(itemId)}. ${kin.nickname} recovered ${done} HP.`);
      if (side.isPlayer) kin.addResonance(1);
    } else if (Items.curesStatus(itemId) && kin.status !== "None") {
      this._log(`${side.name} used ${Items.displayName(itemId)}. ${kin.nickname}'s ${kin.status} was cured.`);
      kin.clearStatus();
      if (side.isPlayer) kin.addResonance(1);
    }
  }

  _tryFlee() {
    if (!this.enemy.isWild) { this._log("You can't flee a Warden battle!"); return false; }
    const ps = this.player.active.effectiveStat("speed");
    const es = Math.max(1, this.enemy.active.effectiveStat("speed"));
    const chance = ps >= es ? 90 : 50 + Math.floor(ps * 40 / es);
    if (this.rng.chance(chance)) { this._log("Got away safely!"); return true; }
    this._log("Couldn't get away!");
    return false;
  }

  _resolveCatch(resonatorId) {
    if (!this.enemy.isWild) { this._log("You can't catch another Warden's Kin!"); return; }
    const target = this.enemy.active;
    const { caught, shakes } = Catching.tryCatch(target, resonatorId, this.rng);
    this._log(`You hurl a ${Items.displayName(resonatorId)}...`);
    this._anim({ kind: "catch", shakes, caught });
    this._log(".".repeat(Math.max(1, shakes)) + (caught ? " click!" : " it broke free!"));
    if (caught) {
      this._log(`Gotcha! ${target.nickname} resonates with you now.`);
      target.addResonance(10);
      this.outcome = "Caught";
    }
  }

  _performMove(side, foe, moveId) {
    const user = side.active;
    if (!this._canAct(user, side)) return;

    const move = this.data.move(moveId);
    const isArt = user.species.resonanceArt === moveId && move.isResonanceArt;
    if (isArt) {
      if (!user.canUseArt(move)) { this._log(`${user.nickname} isn't in Sync enough for ${move.name}!`); return; }
      if (user.hasPerfectResonance && !user.artUsedFree && user.sync < move.syncCost) user.artUsedFree = true;
      else user.spendSync(move.syncCost);
      this._log(`✦ ${user.nickname} channels its Resonance Art — ${move.name}!`);
    } else {
      this._log(`${user.nickname} used ${move.name}!`);
    }
    this._anim({ kind: "move", side: this._sideName(side), element: move.type, isArt, category: move.category });

    if (move.accuracy > 0 && !this.rng.chance(move.accuracy)) {
      this._log(`${user.nickname}'s attack missed!`);
      user.addSync(3); this._shiftTemperament(user, move);
      return;
    }

    const target = foe.active;
    if (move.category !== "status" && move.power > 0) {
      const res = computeDamage(user, target, move, this.data, this.rng);
      if (res.typeMult === 0) { this._log(`It doesn't affect ${target.nickname}...`); return; }
      const dealt = target.takeDamage(res.damage);
      if (res.crit) this._log("A critical hit!");
      const eff = this.data.constructor.describeEffectiveness(res.typeMult);
      if (eff) this._log(eff);
      this._log(`${target.nickname} took ${dealt} damage. (${target.currentHp}/${target.maxHp} HP)`);
      this._anim({ kind: "hit", side: this._sideName(foe), element: move.type, typeMult: res.typeMult, crit: res.crit });
      this._gainSync(user, res.typeMult);

      if (move.effect.drainPercent > 0) {
        const d = user.heal(Math.floor(dealt * move.effect.drainPercent / 100));
        if (d > 0) this._log(`${user.nickname} drained ${d} HP.`);
      }
      if (move.effect.recoilPercent > 0 && !user.isFainted) {
        const r = Math.max(1, Math.floor(dealt * move.effect.recoilPercent / 100));
        user.takeDamage(r); this._log(`${user.nickname} is hit with ${r} recoil.`);
      }
    } else {
      user.addSync(10);
    }

    this._applyEffects(side, foe, move);
    this._shiftTemperament(user, move);
  }

  _applyEffects(side, foe, move) {
    const user = side.active, target = foe.active, fx = move.effect || {};
    if (fx.healPercent > 0) {
      const h = user.heal(Math.floor(user.maxHp * fx.healPercent / 100));
      if (h > 0) this._log(`${user.nickname} restored ${h} HP.`);
    }
    if (fx.selfStat && fx.selfStat.stages) {
      const a = user.changeStage(fx.selfStat.stat, fx.selfStat.stages);
      if (a !== 0) this._log(`${user.nickname}'s ${fx.selfStat.stat} ${a > 0 ? "rose" : "fell"}!`);
    }
    if (fx.targetStat && fx.targetStat.stages && !target.isFainted) {
      const a = target.changeStage(fx.targetStat.stat, fx.targetStat.stages);
      if (a !== 0) this._log(`${target.nickname}'s ${fx.targetStat.stat} ${a > 0 ? "rose" : "fell"}!`);
    }
    if (fx.status && fx.statusChance > 0 && !target.isFainted) {
      const status = cap(fx.status);
      if (this.rng.chance(fx.statusChance) && target.setStatus(status)) {
        if (status === "Dazed") target.setStatusCounter(this.rng.range(2, 4));
        this._log(`${target.nickname} is now ${status}!`);
        this._anim({ kind: "status", side: this._sideName(foe), status });
      }
    }
  }

  _gainSync(user, mult) { user.addSync(mult > 1 ? 25 : mult < 1 ? 8 : 15); }

  _shiftTemperament(user, move) {
    if (move.category === "status" || (move.effect && move.effect.healPercent > 0)) user.shiftTemperament(-2);
    else user.shiftTemperament(2);
  }

  _canAct(kin, side) {
    if (kin.status === "Shock" && this.rng.chance(25)) { this._log(`${kin.nickname} is shocked and can't move!`); return false; }
    if (kin.status === "Chill" && this.rng.chance(20)) { this._log(`${kin.nickname} is too chilled to move!`); return false; }
    if (kin.status === "Dazed") {
      if (kin.statusCounter <= 0) { kin.clearStatus(); }
      else {
        kin.decrementStatusCounter();
        if (this.rng.chance(33)) {
          const self = Math.max(1, Math.floor(kin.maxHp / 12));
          kin.takeDamage(self); this._log(`${kin.nickname} is dazed and hurt itself (${self})!`);
          return false;
        }
      }
    }
    return true;
  }

  _endOfTurn(kin) {
    if (kin.isFainted) return;
    if (kin.status === "Burn") { const d = Math.max(1, Math.floor(kin.maxHp / 16)); kin.takeDamage(d); this._log(`${kin.nickname} is hurt by its burn (${d}).`); }
    else if (kin.status === "Root") { const d = Math.max(1, Math.floor(kin.maxHp / 8)); kin.takeDamage(d); this._log(`${kin.nickname} is sapped by roots (${d}).`); }
    else if (kin.status === "Chill" && this.rng.chance(20)) { kin.clearStatus(); this._log(`${kin.nickname} thawed out!`); }
  }

  _resolveFaints() {
    this._handleFaint(this.enemy);
    this._handleFaint(this.player);
  }

  _handleFaint(side) {
    if (!side.active.isFainted || this.outcome !== "Ongoing") return;
    this._log(`${side.active.nickname} fainted!`);
    this._anim({ kind: "faint", side: this._sideName(side) });
    if (!side.party.hasFightableKin) {
      this.outcome = side.isPlayer ? "EnemyWin" : "PlayerWin";
      if (this.outcome === "PlayerWin") this._awardVictory();
      return;
    }
    side.party.switchTo(side.party.firstHealthyIndex());
    this._log(`${side.name} sends out ${side.active.nickname}!`);
    this._anim({ kind: "switchIn", side: this._sideName(side) });
  }

  _awardVictory() {
    for (const k of this.player.party.members.filter(k => !k.isFainted))
      k.addResonance(k === this.player.active ? 3 : 1);
  }

  _chooseEnemyAction() {
    const self = this.enemy.active, foe = this.player.active;
    let best = null, bestScore = -Infinity;
    for (const m of this.availableMoves(self)) {
      const score = this._scoreMove(self, foe, m);
      if (score > bestScore) { bestScore = score; best = m; }
    }
    best = best || this.data.move(self.moves[0]);
    return { kind: "move", moveId: best.id };
  }

  _scoreMove(self, foe, m) {
    if (m.isResonanceArt && !self.canUseArt(m)) return -Infinity;
    if (m.category === "status") {
      if (m.effect.healPercent > 0) return self.hpFraction < 0.5 ? 130 : 15;
      if (m.effect.status) return 55;
      if (m.effect.selfStat) return this.turn <= 1 ? 40 : 20;
      if (m.effect.targetStat) return 35;
      return 12;
    }
    const eff = this.data.typeMultiplier(m.type, foe.types);
    const stab = self.types.includes(m.type) ? STAB : 1.0;
    return m.power * stab * eff + (m.isResonanceArt ? 60 : 0);
  }
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
