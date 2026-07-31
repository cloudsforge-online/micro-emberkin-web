// A living creature instance. Faithful port of Kindred.Core.Kin, including the
// Resonance / Temperament / Sync bond systems and temperament-branch evolution.

import { STATS } from "./data.js";

const STAT_INDEX = { hp: 0, attack: 1, defense: 2, spatk: 3, spdef: 4, speed: 5 };

export class Kin {
  constructor(species) {
    this.species = species;
    this._nickname = null;
    this.level = 1;
    this.xp = 0;
    this.resonance = 0;      // 0..100 persistent bond
    this.temperament = 0;    // -100 (Harmony) .. +100 (Ferocity)
    this.sync = 0;           // 0..100 per-battle
    this.attunement = { hp: 0, attack: 0, defense: 0, spatk: 0, spdef: 0, speed: 0 };
    this.moves = [];
    this.heldItem = null;
    this.currentHp = 1;
    this.status = "None";
    this.statusCounter = 0;
    this.stages = [0, 0, 0, 0, 0, 0];
    this.artUsedFree = false;
  }

  get nickname() { return this._nickname ?? this.species.name; }
  set nickname(v) { this._nickname = (v && v.trim()) ? v.trim() : null; }
  get hasCustomNickname() { return this._nickname !== null; }
  get types() { return this.species.types; }

  static create(species, level, rng, resonance = 0, temperament = null) {
    const k = new Kin(species);
    k.level = clamp(level, 1, 100);
    for (const s of STATS) k.attunement[s] = rng.range(0, 15);
    k.resonance = clamp(resonance, 0, 100);
    k.temperament = clamp(temperament ?? species.temperamentBias ?? 0, -100, 100);
    k.xp = Kin.xpForLevel(k.level, k.growth);
    k._autoLearn(k.level);
    k.currentHp = k.maxHp;
    return k;
  }

  static createWild(species, level, rng) {
    return Kin.create(species, level, rng, 0, species.temperamentBias ?? 0);
  }

  get growth() { return this.species.growthRate || "medium"; }

  get resonanceStatMultiplier() {
    if (this.resonance >= 100) return 1.12;
    if (this.resonance >= 25) return 1.06;
    return 1.0;
  }

  get maxHp() {
    const b = this.species.baseStats.hp, iv = this.attunement.hp;
    const raw = Math.floor((2 * b + iv) * this.level / 100) + this.level + 10;
    return Math.floor(raw * this.resonanceStatMultiplier);
  }

  baseStat(stat) {
    if (stat === "hp") return this.maxHp;
    const b = this.species.baseStats[stat], iv = this.attunement[stat];
    const raw = Math.floor((2 * b + iv) * this.level / 100) + 5;
    return Math.max(1, Math.floor(raw * this.resonanceStatMultiplier));
  }

  effectiveStat(stat) {
    let v = this.baseStat(stat);
    v *= stageMult(this.stages[STAT_INDEX[stat]]);
    if (stat === "attack" && this.status === "Burn") v *= 0.5;
    if (stat === "speed" && this.status === "Chill") v *= 0.5;
    return Math.max(1, Math.floor(v));
  }

  getStage(stat) { return this.stages[STAT_INDEX[stat]]; }
  changeStage(stat, delta) {
    const i = STAT_INDEX[stat], before = this.stages[i];
    this.stages[i] = clamp(before + delta, -6, 6);
    return this.stages[i] - before;
  }

  get isFainted() { return this.currentHp <= 0; }
  get hpFraction() { return this.maxHp === 0 ? 0 : this.currentHp / this.maxHp; }

  takeDamage(amount) {
    const dealt = clamp(amount, 0, this.currentHp);
    this.currentHp -= dealt;
    return dealt;
  }
  heal(amount) {
    const healed = clamp(amount, 0, this.maxHp - this.currentHp);
    this.currentHp += healed;
    return healed;
  }
  fullRestore() { this.currentHp = this.maxHp; this.status = "None"; this.statusCounter = 0; }

  setStatus(status) {
    if (this.status !== "None" || status === "None") return false;
    this.status = status; this.statusCounter = 0; return true;
  }
  clearStatus() { this.status = "None"; this.statusCounter = 0; }
  setStatusCounter(n) { this.statusCounter = Math.max(0, n); }
  decrementStatusCounter() { if (this.statusCounter > 0) this.statusCounter--; }

  resetBattleState() { this.sync = 0; this.stages = [0,0,0,0,0,0]; this.artUsedFree = false; }

  addResonance(d) { this.resonance = clamp(this.resonance + d, 0, 100); }
  shiftTemperament(d) { this.temperament = clamp(this.temperament + d, -100, 100); }
  addSync(d) { this.sync = clamp(this.sync + d, 0, 100); }
  spendSync(d) { this.sync = clamp(this.sync - d, 0, 100); }

  get isAttuned() { return this.resonance >= 25; }
  get isResonant() { return this.resonance >= 50; }
  get hasPerfectResonance() { return this.resonance >= 100; }

  get temperamentLabel() {
    const t = this.temperament;
    if (t >= 60) return "Ferocious";
    if (t >= 20) return "Bold";
    if (t > -20) return "Balanced";
    if (t > -60) return "Gentle";
    return "Serene";
  }

  canUseArt(art) {
    return this.isResonant && this.species.resonanceArt === art.id &&
      (this.sync >= art.syncCost || (this.hasPerfectResonance && !this.artUsedFree));
  }

  static xpForLevel(level, growth) {
    const cube = level * level * level;
    if (growth === "fast") return Math.floor(0.8 * cube);
    if (growth === "slow") return Math.floor(1.25 * cube);
    return Math.floor(cube);
  }
  get xpToNext() { return this.level >= 100 ? 0 : Kin.xpForLevel(this.level + 1, this.growth) - this.xp; }

  gainXp(amount) {
    const learned = [];
    if (this.level >= 100) return learned;
    this.xp += Math.max(0, amount);
    while (this.level < 100 && this.xp >= Kin.xpForLevel(this.level + 1, this.growth)) {
      this.level++;
      for (const le of this.species.learnset.filter(l => l.level === this.level))
        if (this.tryLearn(le.move)) learned.push(le.move);
    }
    return learned;
  }

  _autoLearn(level) {
    this.moves = [];
    const eligible = this.species.learnset.filter(l => l.level <= level).sort((a, b) => a.level - b.level);
    for (const le of eligible) {
      if (this.moves.includes(le.move)) continue;
      if (this.moves.length < 4) this.moves.push(le.move);
      else { this.moves.shift(); this.moves.push(le.move); }
    }
    if (this.moves.length === 0 && eligible.length) this.moves.push(eligible[0].move);
  }

  tryLearn(moveId) {
    if (this.moves.includes(moveId)) return false;
    if (this.moves.length < 4) { this.moves.push(moveId); return true; }
    return false;
  }

  checkEvolution(region = null, time = "day") {
    for (const ev of this.species.evolutions) {
      const r = ev.requires || {};
      if (r.resonance > 0 && this.resonance < r.resonance) continue;
      if (r.level > 0 && this.level < r.level) continue;
      if (r.temperamentMin != null && this.temperament < r.temperamentMin) continue;
      if (r.temperamentMax != null && this.temperament > r.temperamentMax) continue;
      if (r.heldItem && this.heldItem !== r.heldItem) continue;
      if (r.region && region !== r.region) continue;
      if (r.timeOfDay && r.timeOfDay.toLowerCase() !== time.toLowerCase()) continue;
      return ev.into;
    }
    return null;
  }

  evolveInto(newSpecies) {
    const frac = this.hpFraction;
    this.species = newSpecies;
    const learned = [];
    for (const le of newSpecies.learnset.filter(l => l.level <= this.level))
      if (this.tryLearn(le.move)) learned.push(le.move);
    this.currentHp = Math.max(1, Math.floor(this.maxHp * frac));
    return learned;
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function stageMult(stage) { return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage); }
