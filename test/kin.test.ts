/**
 * The one piece of engine arithmetic this client reproduces, and the reason it is exact.
 *
 * The save carries `currentHp` but not `maxHp` (`emberkin/src/engine/saves.ts:9-22`). Every input
 * to the derivation IS on the wire, though — `attunement`, `level` and `resonance` from the save,
 * `baseStats.hp` from the local content copy — so `maxHpOf` reproduces
 * `emberkin/src/engine/kin.ts:148-153` rather than estimating.
 *
 *     const raw = Math.trunc(((2 * b + iv) * this.level) / 100) + this.level + 10
 *     return Math.trunc(raw * this.resonanceStatMultiplier)
 *
 * TWO TRUNCATIONS, IN THAT ORDER. Doing it in one expression, or rounding instead of truncating,
 * is off by one across most of the level range — and a health bar that disagrees with the server by
 * one point at the bottom of the scale is the difference between "fainted" and "hanging on".
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { maxHpOf } from '../src/components/kin.tsx'

const kin = (level: number, hpIv: number, resonance: number) => ({
  level,
  resonance,
  attunement: { hp: hpIv, attack: 0, defense: 0, spatk: 0, spdef: 0, speed: 0 },
})

/** The engine's own expression, written out longhand, as the oracle. */
function reference(baseHp: number, level: number, iv: number, multiplier: number): number {
  const raw = Math.trunc(((2 * baseHp + iv) * level) / 100) + level + 10
  return Math.trunc(raw * multiplier)
}

describe('maxHpOf', () => {
  it('matches the engine at level 1, no Attunement, no bond', () => {
    // trunc((2*45 + 0) * 1 / 100) = 0, + 1 + 10 = 11, × 1 = 11.
    assert.equal(maxHpOf(45, kin(1, 0, 0)), 11)
  })

  it('matches the engine at level 50', () => {
    // trunc((90 + 0) * 50 / 100) = 45, + 50 + 10 = 105.
    assert.equal(maxHpOf(45, kin(50, 0, 0)), 105)
  })

  it('includes the per-instance Attunement term', () => {
    // trunc((90 + 31) * 50 / 100) = trunc(60.5) = 60, + 60 = 120.
    assert.equal(maxHpOf(45, kin(50, 31, 0)), 120)
  })

  it('TRUNCATES the level term before the flat term is added', () => {
    // (90 + 31) * 50 / 100 is 60.5. Truncated first: 60 + 60 = 120. Rounded, or truncated only at
    // the end: 61 + 60 = 121. One point apart, at every level where the division is not exact.
    assert.equal(maxHpOf(45, kin(50, 31, 0)), 120)
    assert.notEqual(maxHpOf(45, kin(50, 31, 0)), 121)
  })

  it('applies the Resonance multiplier and truncates AGAIN', () => {
    // raw 105 × 1.06 = 111.3 → 111, not 112.
    assert.equal(maxHpOf(45, kin(50, 0, 25)), 111)
  })

  it('is unmultiplied below Resonance 25', () => {
    assert.equal(maxHpOf(45, kin(50, 0, 24)), 105)
  })

  it('steps at exactly 25', () => {
    assert.equal(maxHpOf(45, kin(50, 0, 24)), 105)
    assert.equal(maxHpOf(45, kin(50, 0, 25)), 111)
  })

  it('steps again at exactly 100, to 1.12 and not 1.06', () => {
    // The service tests 100 BEFORE 25 (`kin.ts:143-146`), so 100 is 1.12.
    assert.equal(maxHpOf(45, kin(50, 0, 99)), 111)
    assert.equal(maxHpOf(45, kin(50, 0, 100)), 117) // trunc(105 * 1.12) = trunc(117.6)
  })

  it('agrees with the reference expression across the whole level range', () => {
    // Fifty levels × three bond bands × three base stats. If the two ever disagree, this names the
    // exact case rather than leaving somebody to guess which level broke.
    for (let level = 1; level <= 100; level += 1) {
      for (const [resonance, multiplier] of [
        [0, 1],
        [25, 1.06],
        [100, 1.12],
      ] as const) {
        for (const base of [45, 78, 120]) {
          for (const iv of [0, 17, 31]) {
            assert.equal(
              maxHpOf(base, kin(level, iv, resonance)),
              reference(base, level, iv, multiplier),
              `base ${base}, level ${level}, iv ${iv}, resonance ${resonance}`,
            )
          }
        }
      }
    }
  })

  it('treats a missing hp Attunement as zero rather than as NaN', () => {
    // `attunement` is a JSONB blob on the wire; a save written by an older migration could lack a
    // key, and `NaN` would render as a bar of width NaN% and an aria-valuemax of NaN.
    const result = maxHpOf(45, { level: 50, resonance: 0, attunement: {} })
    assert.equal(result, 105)
    assert.ok(Number.isFinite(result))
  })

  it('is never zero at level 1, so a fresh Kin is not born fainted', () => {
    assert.ok(maxHpOf(1, kin(1, 0, 0)) > 0)
  })
})
