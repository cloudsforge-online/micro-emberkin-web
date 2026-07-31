// Item catalogue + catch resolution. Mirrors Kindred.Core.Items / Catching.

export const Items = {
  resonators: ["resonator", "greater_resonator", "master_resonator"],

  healAmount(id) {
    return ({ potion: 40, super_potion: 90, hyper_potion: 160, max_potion: 99999 })[id] || 0;
  },
  curesStatus(id) { return id === "salve" || id === "full_heal"; },
  isResonator(id) { return Items.resonators.includes(id); },
  resonatorPower(id) {
    return ({ resonator: 1.0, greater_resonator: 1.5, master_resonator: 255.0 })[id] || 1.0;
  },
  displayName(id) {
    return ({
      potion: "Potion", super_potion: "Super Potion", hyper_potion: "Hyper Potion", max_potion: "Max Potion",
      salve: "Salve", full_heal: "Full Heal",
      resonator: "Resonator", greater_resonator: "Greater Resonator", master_resonator: "Master Resonator",
    })[id] || id;
  },
};

export const Catching = {
  catchChance(target, resonatorId) {
    const ball = Items.resonatorPower(resonatorId);
    if (ball >= 255) return 1.0;
    const max = target.maxHp, cur = Math.max(0, target.currentHp);
    const hpFactor = (3 * max - 2 * cur) / (3 * max);
    const statusFactor = target.status === "None" ? 1.0
      : (target.status === "Chill" || target.status === "Shock") ? 1.6 : 1.3;
    const a = target.species.catchRate * ball * hpFactor * statusFactor;
    return Math.max(0.03, Math.min(1.0, a / 255));
  },

  tryCatch(target, resonatorId, rng) {
    const p = Catching.catchChance(target, resonatorId);
    const caught = rng.nextDouble() < p;
    const shakes = caught ? 3 : rng.range(0, 2);
    return { caught, shakes };
  },
};
