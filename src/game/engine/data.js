// Game content access + type chart. Mirrors Kindred.Core.GameData / TypeChart.

export const ELEMENTS = ["ember","tide","verdant","gale","stone","spark","frost","umbra","lumen"];
export const STATS = ["hp","attack","defense","spatk","spdef","speed"];

export class GameData {
  constructor({ types, moves, species, campaign, visuals }) {
    this.types = types;
    this.moves = new Map(moves.map(m => [m.id, m]));
    this.species = new Map(species.map(s => [s.id, s]));
    this.dex = [...species].sort((a, b) => a.dexNumber - b.dexNumber);
    this.campaign = campaign;
    this.visuals = new Map((visuals || []).map(v => [v.id, v]));
  }

  move(id) {
    const m = this.moves.get(id);
    if (!m) throw new Error(`Unknown move '${id}'`);
    return m;
  }
  getSpecies(id) {
    const s = this.species.get(id);
    if (!s) throw new Error(`Unknown species '${id}'`);
    return s;
  }
  visual(id) { return this.visuals.get(id) || null; }

  /** Elemental multiplier of one attacking type vs a list of defender types. */
  typeMultiplier(attacker, defenderTypes) {
    let m = 1.0;
    const row = this.types.chart[attacker] || {};
    for (const d of defenderTypes) m *= (row[d] ?? 1.0);
    return m;
  }

  static describeEffectiveness(m) {
    if (m === 0) return "It has no effect...";
    if (m < 1) return "It's not very effective...";
    if (m > 1) return "It's super effective!";
    return "";
  }

  /** Referential-integrity check (used by the smoke test). */
  validate() {
    const errors = [];
    const valid = new Set(this.types.elements);
    for (const s of this.species.values()) {
      for (const t of s.types) if (!valid.has(t)) errors.push(`${s.id} bad type ${t}`);
      for (const le of s.learnset) if (!this.moves.has(le.move)) errors.push(`${s.id} bad move ${le.move}`);
      if (s.resonanceArt && !this.moves.has(s.resonanceArt)) errors.push(`${s.id} bad art ${s.resonanceArt}`);
      for (const ev of s.evolutions) if (!this.species.has(ev.into)) errors.push(`${s.id} bad evo ${ev.into}`);
    }
    return errors;
  }

  /** Browser loader — fetches the JSON that the Pages build copies to /data. */
  static async load(base = "../data") {
    const get = f => fetch(`${base}/${f}`).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${f}: ${r.status}`);
      return r.json();
    });
    const [types, moves, species, campaign, visuals] = await Promise.all([
      get("types.json"), get("moves.json"), get("species.json"),
      get("campaign.json"), get("visuals.json"),
    ]);
    return new GameData({ types, moves, species, campaign, visuals });
  }
}
