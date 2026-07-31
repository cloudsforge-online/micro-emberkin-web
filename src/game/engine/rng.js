// Deterministic, seedable PRNG (xorshift128+ seeded via SplitMix64), a faithful
// port of Kindred.Core.Rng so the web game matches the C# engine's behaviour.
// Uses BigInt for exact 64-bit arithmetic (not perf-critical).

const MASK = (1n << 64n) - 1n;

export class Rng {
  constructor(seed) {
    this.seed = BigInt(seed) & MASK;
    let x = this.seed;
    const sm = () => {
      x = (x + 0x9E3779B97F4A7C15n) & MASK;
      let z = x;
      z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK;
      z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK;
      return (z ^ (z >> 31n)) & MASK;
    };
    this._s0 = sm();
    this._s1 = sm();
    if (this._s0 === 0n && this._s1 === 0n) this._s1 = 0x9E3779B97F4A7C15n;
  }

  _raw() {
    let s1 = this._s0;
    const s0 = this._s1;
    this._s0 = s0;
    s1 ^= (s1 << 23n) & MASK;
    this._s1 = (s1 ^ s0 ^ (s1 >> 18n) ^ (s0 >> 5n)) & MASK;
    return (this._s1 + s0) & MASK;
  }

  /** Uniform double in [0,1). */
  nextDouble() {
    return Number(this._raw() >> 11n) * (1.0 / 9007199254740992.0);
  }

  /** Uniform int in [0, maxExclusive). */
  next(maxExclusive) {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.nextDouble() * maxExclusive);
  }

  /** Uniform int in [min, max] inclusive. */
  range(min, max) {
    if (max <= min) return min;
    return min + this.next(max - min + 1);
  }

  /** True with the given percent chance (0-100). */
  chance(percent) {
    if (percent <= 0) return false;
    if (percent >= 100) return true;
    return this.nextDouble() * 100 < percent;
  }

  weighted(items, weightFn) {
    const total = items.reduce((a, it) => a + weightFn(it), 0);
    if (total <= 0) return items[this.next(items.length)];
    let roll = this.next(total);
    for (const it of items) {
      roll -= weightFn(it);
      if (roll < 0) return it;
    }
    return items[items.length - 1];
  }
}
