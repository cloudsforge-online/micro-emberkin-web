/**
 * Resonance, Temperament and Sync: the display arithmetic.
 *
 * Every constant this module holds is `micro-emberkin`'s, and a copy that drifts is worse than no
 * copy — a bar that fills at 25 while the server grants the bonus at 30 means nobody knows which
 * is lying. So the tests are written against the SERVICE's numbers, cited, and the boundaries are
 * driven from both sides.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bandFor,
  describeResonance,
  describeSync,
  describeTemperament,
  nextBandFor,
  RESONANCE_BANDS,
  resonanceChange,
  statMultiplier,
  TEMPERAMENT_MAX,
  TEMPERAMENT_MIN,
} from '../src/lib/resonance.ts'

describe('the bands', () => {
  it('are 0, 25, 50 and 100 — engine/kin.ts and 258-266', () => {
    assert.deepEqual(
      RESONANCE_BANDS.map((b) => b.at),
      [0, 25, 50, 100],
    )
  })

  it('are strictly ascending, so bandFraction can never divide by zero', () => {
    for (let i = 1; i < RESONANCE_BANDS.length; i += 1) {
      assert.ok(RESONANCE_BANDS[i]!.at > RESONANCE_BANDS[i - 1]!.at)
    }
  })

  it('agree with battles.ts, where the achievements are granted', () => {
    // `RESONANCE_THRESHOLDS` in the service: attuned 25, resonant 50, perfect 100. If the service
    // ever moves one and not the other, this app should fail its own test rather than show a
    // milestone that pays nothing.
    const byAchievement = new Map(
      RESONANCE_BANDS.filter((b) => b.achievement).map((b) => [b.achievement as string, b.at]),
    )
    assert.equal(byAchievement.get('resonance_attuned'), 25)
    assert.equal(byAchievement.get('resonance_resonant'), 50)
    assert.equal(byAchievement.get('resonance_perfect'), 100)
  })

  it('name 50 as Resonant with no stat change, because kin.ts does not step there', () => {
    const resonant = RESONANCE_BANDS.find((b) => b.at === 50)
    assert.equal(resonant?.name, 'Resonant')
    assert.equal(resonant?.statMultiplier, 1.06)
  })

  it('give every band a real, mechanical effect sentence', () => {
    for (const band of RESONANCE_BANDS) {
      assert.ok(band.effect.length > 0, `${band.name} has no stated effect`)
    }
  })
})

describe('bandFor', () => {
  const cases: readonly [number, string][] = [
    [0, 'Unbonded'],
    [1, 'Unbonded'],
    [24, 'Unbonded'],
    [25, 'Attuned'],
    [26, 'Attuned'],
    [49, 'Attuned'],
    [50, 'Resonant'],
    [51, 'Resonant'],
    [99, 'Resonant'],
    [100, 'Perfect Resonance'],
  ]
  it('names the band on both sides of every threshold', () => {
    // A table rather than ten near-identical cases. The boundaries — 24/25, 49/50, 99/100 — are
    // the whole content; ten `it`s would be ten copies of one assertion.
    for (const [value, name] of cases) {
      assert.equal(bandFor(value).name, name, `Resonance ${value}`)
    }
    assert.equal(cases.length, 10, 'the table shrank; the boundaries may no longer be covered')
  })

  it('clamps a nonsense value to the first band rather than returning undefined', () => {
    assert.equal(bandFor(-5).name, 'Unbonded')
  })
})

describe('nextBandFor', () => {
  it('is the next threshold strictly above the value', () => {
    assert.equal(nextBandFor(0)?.at, 25)
    assert.equal(nextBandFor(24)?.at, 25)
    assert.equal(nextBandFor(25)?.at, 50)
    assert.equal(nextBandFor(50)?.at, 100)
  })

  it('is null at Perfect Resonance', () => {
    assert.equal(nextBandFor(100), null)
  })
})

describe('statMultiplier — engine/kin.ts, ORDER INCLUDED', () => {
  it('is 1 below 25', () => {
    assert.equal(statMultiplier(0), 1)
    assert.equal(statMultiplier(24), 1)
  })

  it('is 1.06 from 25', () => {
    assert.equal(statMultiplier(25), 1.06)
    assert.equal(statMultiplier(99), 1.06)
  })

  it('is 1.12 at 100 — the 100 test runs FIRST in the service, so it is not 1.06', () => {
    assert.equal(statMultiplier(100), 1.12)
  })
})

describe('describeResonance', () => {
  it('reports the overall fraction against the full scale', () => {
    assert.equal(describeResonance(50).fraction, 0.5)
    assert.equal(describeResonance(0).fraction, 0)
    assert.equal(describeResonance(100).fraction, 1)
  })

  it('reports progress WITHIN the band, which is the number a player wants', () => {
    // At 49 the overall bar is nearly half full and the interesting fact is "one from the Art".
    const d = describeResonance(49)
    assert.equal(d.band.name, 'Attuned')
    assert.equal(d.toNext, 1)
    assert.equal(d.bandFraction, 24 / 25)
  })

  it('reports bandFraction 0 at the exact start of a band', () => {
    assert.equal(describeResonance(25).bandFraction, 0)
  })

  it('reports toNext null and bandFraction 1 at the top', () => {
    const d = describeResonance(100)
    assert.equal(d.toNext, null)
    assert.equal(d.bandFraction, 1)
    assert.equal(d.next, null)
  })

  it('clamps above 100 and below 0 rather than drawing off the end of the bar', () => {
    assert.equal(describeResonance(140).value, 100)
    assert.equal(describeResonance(-9).value, 0)
    assert.equal(describeResonance(140).fraction, 1)
  })

  it('survives NaN by falling to the minimum, not by rendering NaN%', () => {
    const d = describeResonance(Number.NaN)
    assert.equal(d.value, 0)
    assert.ok(Number.isFinite(d.fraction))
  })
})

describe('describeTemperament', () => {
  it('calls ZERO ferocious, because engine/kin.ts is `temperament >= 0`', () => {
    // The asymmetry is the service's. Calling 0 "balanced" would disagree with the engine at
    // exactly the value a freshly created Kin most often holds.
    const d = describeTemperament(0)
    assert.equal(d.lean, 'ferocity')
    assert.equal(d.label, 'Ferocity')
  })

  it('calls -1 harmonious', () => {
    assert.equal(describeTemperament(-1).lean, 'harmony')
  })

  it('puts zero at the midpoint of the drawn scale', () => {
    assert.equal(describeTemperament(0).fraction, 0.5)
    assert.equal(describeTemperament(TEMPERAMENT_MIN).fraction, 0)
    assert.equal(describeTemperament(TEMPERAMENT_MAX).fraction, 1)
  })

  it('reports intensity as distance from the midpoint', () => {
    assert.equal(describeTemperament(0).intensity, 0)
    assert.equal(describeTemperament(50).intensity, 0.5)
    assert.equal(describeTemperament(-50).intensity, 0.5)
    assert.equal(describeTemperament(-100).intensity, 1)
  })

  it('clamps out-of-range values', () => {
    assert.equal(describeTemperament(500).value, 100)
    assert.equal(describeTemperament(-500).value, -100)
  })
})

describe('describeSync — the number this client does not have', () => {
  it('says it does not know, given nothing', () => {
    const d = describeSync()
    assert.equal(d.known, false)
    assert.equal(d.value, null)
    assert.ok(d.note.length > 0)
  })

  it('says it does not know, given null or undefined', () => {
    assert.equal(describeSync(null).known, false)
    assert.equal(describeSync(undefined).known, false)
  })

  it('NEVER returns zero for unknown — that would be a false claim', () => {
    // A bar drawn at zero says "this Kin has no Sync". It is false for any Kin that has ever
    // spent Sync on an Art, and `kinToSave` (engine/saves.ts) simply does not persist it.
    assert.notEqual(describeSync().value, 0)
  })

  it('does report a real value when one is supplied', () => {
    const d = describeSync(42)
    assert.equal(d.known, true)
    assert.equal(d.value, 42)
  })

  it('clamps a supplied value to 0..100', () => {
    assert.equal(describeSync(500).value, 100)
    assert.equal(describeSync(-5).value, 0)
  })

  it('treats NaN as unknown rather than as a number', () => {
    assert.equal(describeSync(Number.NaN).known, false)
  })
})

describe('resonanceChange', () => {
  it('reports the delta', () => {
    const c = resonanceChange(10, 18)
    assert.equal(c.delta, 8)
    assert.equal(c.before, 10)
    assert.equal(c.after, 18)
  })

  it('reports no crossing when no threshold was passed', () => {
    assert.deepEqual(resonanceChange(10, 18).crossed, [])
  })

  it('reports a crossing when a threshold is LANDED ON exactly', () => {
    const c = resonanceChange(22, 25)
    assert.deepEqual(c.crossed.map((b) => b.name), ['Attuned'])
  })

  it('does not re-report a band already held', () => {
    // 25 → 30 stays Attuned. Announcing "Attuned reached" a second time would train a player to
    // ignore the message that matters.
    assert.deepEqual(resonanceChange(25, 30).crossed, [])
  })

  it('reports EVERY band crossed by a large jump, in order', () => {
    const c = resonanceChange(0, 100)
    assert.deepEqual(c.crossed.map((b) => b.at), [25, 50, 100])
  })

  it('crosses nothing when Resonance falls — a band is a milestone, not a position', () => {
    const c = resonanceChange(60, 20)
    assert.equal(c.delta, -40)
    assert.deepEqual(c.crossed, [])
  })

  it('crosses nothing on no change', () => {
    assert.deepEqual(resonanceChange(50, 50).crossed, [])
    assert.equal(resonanceChange(50, 50).delta, 0)
  })

  it('clamps both ends before comparing', () => {
    const c = resonanceChange(-10, 200)
    assert.equal(c.before, 0)
    assert.equal(c.after, 100)
  })
})
