/**
 * Resonance, Temperament and Sync — made legible.
 *
 * These three are the game's identity (docs/ecosystem/19-new-products.md §1.2: "the bond system is
 * the product"), and a client that renders them as three anonymous bars has thrown that away. This
 * module holds the arithmetic and the naming, so that every screen says the same thing about the
 * same number and a test can check the thresholds against the engine that enforces them.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY CONSTANT HERE IS CITED. These are not this app's numbers; they are `micro-emberkin`'s,
 * and a copy that drifts is worse than no copy — the bar would fill at 25 while the server granted
 * the bonus at 30 and nobody would know which was lying.
 *
 *   Resonance 0..100, persistent            emberkin/src/engine/kin.ts
 *   Temperament -100..+100                  emberkin/src/engine/kin.ts
 *   Sync 0..100, RESETS EACH BATTLE         emberkin/src/engine/kin.ts
 *   Attuned at 25  (+6% stats)              emberkin/src/engine/kin.ts, 258-260
 *   Resonant at 50 (unlocks Resonance Art)  emberkin/src/engine/kin.ts
 *   Perfect at 100 (+12% stats, free Art)   emberkin/src/engine/kin.ts, 264-266, 280-286
 *   Achievement thresholds 25 / 50 / 100    emberkin/src/battles.ts
 *
 * The achievement thresholds and the stat thresholds are the same three numbers, from two places
 * in the service. That coincidence is asserted in `test/resonance.test.ts` rather than assumed: if
 * the service ever moves one and not the other, this app should fail its own test rather than
 * quietly show a milestone that pays nothing.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** `emberkin/src/engine/kin.ts` — `resonance = 0; // 0..100, persistent bond`. */
export const RESONANCE_MIN = 0
export const RESONANCE_MAX = 100

/** `emberkin/src/engine/kin.ts` — `temperament = 0; // -100 (Harmony) .. +100 (Ferocity)`. */
export const TEMPERAMENT_MIN = -100
export const TEMPERAMENT_MAX = 100

/** `emberkin/src/engine/kin.ts` — `sync = 0; // 0..100, resets each battle`. */
export const SYNC_MIN = 0
export const SYNC_MAX = 100

/**
 * A Resonance milestone: the number, its name, and what it actually does.
 *
 * `effect` is prose the player is shown, and it must describe a REAL mechanical consequence — the
 * anti-pay-to-win rule cuts both ways, and a bond milestone that reads like a reward but changes
 * nothing is the same dishonesty pointed the other direction.
 */
export interface ResonanceBand {
  readonly at: number
  readonly name: string
  readonly effect: string
  /** The stat multiplier at this band. `emberkin/src/engine/kin.ts`. */
  readonly statMultiplier: number
  /** The achievement this band unlocks, if any. `emberkin/src/battles.ts`. */
  readonly achievement: string | null
}

/**
 * The bands, ascending.
 *
 * Note that 50 grants NO stat multiplier — `resonanceStatMultiplier` steps at 25 and 100 only
 * (`engine/kin.ts`) — while `isResonant` at 50 (`engine/kin.ts`) is what gates the
 * Resonance Art. Two different mechanics on one scale. A UI that drew one bar with three ticks and
 * one caption would have to pick one and be wrong about the other, which is why `bandFor` returns
 * the band and `describeResonance` returns BOTH the reached band and the next one.
 */
export const RESONANCE_BANDS: readonly ResonanceBand[] = [
  { at: 0, name: 'Unbonded', effect: 'No bond bonus yet.', statMultiplier: 1, achievement: null },
  {
    at: 25,
    name: 'Attuned',
    effect: 'Stats +6% while bonded.',
    statMultiplier: 1.06,
    achievement: 'resonance_attuned',
  },
  {
    at: 50,
    name: 'Resonant',
    effect: 'Resonance Art unlocked — it still costs Sync.',
    statMultiplier: 1.06,
    achievement: 'resonance_resonant',
  },
  {
    at: 100,
    name: 'Perfect Resonance',
    effect: 'Stats +12%, and the first Art each battle is free.',
    statMultiplier: 1.12,
    achievement: 'resonance_perfect',
  },
]

/**
 * The band a Resonance value has reached.
 *
 * Reads the bands descending so the highest reached wins, and clamps below zero to the first band
 * rather than returning undefined — a value out of range is a service that changed, not a reason
 * to render nothing.
 */
export function bandFor(resonance: number): ResonanceBand {
  for (let i = RESONANCE_BANDS.length - 1; i >= 0; i -= 1) {
    const band = RESONANCE_BANDS[i]
    if (band && resonance >= band.at) return band
  }
  return RESONANCE_BANDS[0] as ResonanceBand
}

/** The next band, or null at Perfect Resonance. */
export function nextBandFor(resonance: number): ResonanceBand | null {
  return RESONANCE_BANDS.find((b) => b.at > resonance) ?? null
}

/**
 * The stat multiplier the SERVER will apply at this Resonance.
 *
 * Reproduces `emberkin/src/engine/kin.ts` exactly, including its ordering — 100 is tested
 * before 25, so a value of 100 is 1.12 and not 1.06. Displayed as information, never used to
 * compute a stat this app shows: stats come from the save.
 */
export function statMultiplier(resonance: number): number {
  if (resonance >= 100) return 1.12
  if (resonance >= 25) return 1.06
  return 1
}

/** What a Resonance meter needs to draw itself and caption itself. */
export interface ResonanceDisplay {
  readonly value: number
  /** 0..1 of the full scale, for a meter's width. */
  readonly fraction: number
  readonly band: ResonanceBand
  readonly next: ResonanceBand | null
  /** Points remaining to the next band, or null at the top. Never negative, never zero-as-null. */
  readonly toNext: number | null
  /** 0..1 of the way from the current band to the next, or 1 at the top. */
  readonly bandFraction: number
}

/**
 * Everything a Resonance meter should say.
 *
 * `bandFraction` is progress WITHIN the band, which is the number a player actually wants — at 49
 * Resonance the overall bar is half full and the interesting fact is "one point from the Art". The
 * two are different and both are shown; showing only the first is why bond systems feel opaque.
 *
 * A band of zero width cannot occur in `RESONANCE_BANDS` (0, 25, 50, 100 are strictly ascending),
 * but the guard is here anyway because the alternative to a guard is a division by zero rendering
 * `NaN%` into a player's face.
 */
export function describeResonance(raw: number): ResonanceDisplay {
  const value = clamp(raw, RESONANCE_MIN, RESONANCE_MAX)
  const band = bandFor(value)
  const next = nextBandFor(value)
  const span = next ? next.at - band.at : 0
  return {
    value,
    fraction: value / RESONANCE_MAX,
    band,
    next,
    toNext: next ? next.at - value : null,
    bandFraction: next && span > 0 ? (value - band.at) / span : 1,
  }
}

/**
 * Temperament, as a lean rather than a level.
 *
 * `emberkin/src/engine/kin.ts` — `temperamentIsFerocious` is `temperament >= 0`, so ZERO
 * IS FEROCIOUS, not neutral. That asymmetry is the service's and is reproduced rather than
 * tidied: a client that called 0 "balanced" would disagree with the engine at exactly the value
 * a freshly created Kin most often holds (`engine/kin.ts` seeds from `species.temperamentBias`).
 */
export interface TemperamentDisplay {
  readonly value: number
  /** 'harmony' below zero, 'ferocity' at zero and above. */
  readonly lean: 'harmony' | 'ferocity'
  readonly label: string
  /** 0..1 from Harmony to Ferocity, for a two-ended meter. 0.5 is the midpoint of the SCALE. */
  readonly fraction: number
  /** How far from the midpoint, 0..1 — the strength of the lean. */
  readonly intensity: number
}

export function describeTemperament(raw: number): TemperamentDisplay {
  const value = clamp(raw, TEMPERAMENT_MIN, TEMPERAMENT_MAX)
  const lean: 'harmony' | 'ferocity' = value >= 0 ? 'ferocity' : 'harmony'
  return {
    value,
    lean,
    label: lean === 'ferocity' ? 'Ferocity' : 'Harmony',
    fraction: (value - TEMPERAMENT_MIN) / (TEMPERAMENT_MAX - TEMPERAMENT_MIN),
    intensity: Math.abs(value) / TEMPERAMENT_MAX,
  }
}

/**
 * Sync — which this client CANNOT read, and says so.
 *
 * Sync resets each battle (`emberkin/src/engine/kin.ts`) and `kinToSave`
 * (`emberkin/src/engine/saves.ts`) does not persist it, so it is absent from every save this
 * app receives. There is no route that returns a live battle's Sync, because a battle is resolved
 * in one request and returns a log, not a running state (`emberkin/src/server.ts`).
 *
 * Rule 4 of the brief — never invent a number — makes this function's shape the whole point: it
 * returns `known: false` and a sentence, and the HUD renders that sentence in the Sync slot
 * instead of a bar at zero. A bar at zero is a claim, and it would be false for any Kin that had
 * ever spent Sync on an Art.
 */
export interface SyncDisplay {
  readonly known: boolean
  readonly value: number | null
  readonly note: string
}

export function describeSync(value?: number | null): SyncDisplay {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const v = clamp(value, SYNC_MIN, SYNC_MAX)
    return { known: true, value: v, note: 'Spent on Resonance Arts. Resets each battle.' }
  }
  return {
    known: false,
    value: null,
    note: 'Sync is per-battle and is not carried in a save, so it is not known outside a battle.',
  }
}

/**
 * A change worth showing after a battle: what moved, by how much, and why it matters.
 *
 * `crossed` is the reason this returns a structure rather than a number. "Resonance +4" is a
 * number; "Resonance +4 — Resonant reached, the Resonance Art is unlocked" is the game telling the
 * player what their care bought, which is the thing 19 §1.5.2 asks for.
 */
export interface ResonanceChange {
  readonly before: number
  readonly after: number
  readonly delta: number
  /** Bands newly crossed by this change, ascending. Empty when none were. */
  readonly crossed: readonly ResonanceBand[]
}

export function resonanceChange(before: number, after: number): ResonanceChange {
  const lo = clamp(before, RESONANCE_MIN, RESONANCE_MAX)
  const hi = clamp(after, RESONANCE_MIN, RESONANCE_MAX)
  return {
    before: lo,
    after: hi,
    delta: hi - lo,
    // Strictly `> lo` and `<= hi`: a band already held is not "reached", and a band exactly landed
    // on is. Losing Resonance crosses nothing — bands are milestones, not a position.
    crossed: hi > lo ? RESONANCE_BANDS.filter((b) => b.at > lo && b.at <= hi) : [],
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
