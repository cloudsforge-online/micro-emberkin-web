/**
 * Types: the chip that cannot be colour alone, and the chart.
 *
 * The brief said `ui/` carries a CVD-corrected type palette. It does not — `micro-ui` has the five
 * product accents and an eight-slot categorical viz palette, both validated, and neither is an
 * element palette. The nine element hues that DO exist are art-direction values recorded per icon
 * in the asset manifest.
 *
 * The first suite below is the correction, made mechanical: it measures the nine and shows that
 * several pairs are not separable as interface colour, which is WHY every chip carries an icon and
 * a written name. If somebody later "simplifies" a chip to a dot, the second suite fails.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  effectiveness,
  effectivenessAgainst,
  effectivenessLabel,
  ELEMENTS,
  elementName,
  isElement,
  typeChip,
  type TypeChart,
} from '../src/lib/types.ts'
import { accentFor } from '../src/lib/art.ts'

const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8')
const typesData = JSON.parse(read('public/game/data/types.json')) as { elements: string[]; chart: TypeChart }

describe('the elements', () => {
  it('are the nine in types.json, in its order', () => {
    assert.deepEqual([...ELEMENTS], typesData.elements)
  })

  it('recognises each of them and nothing else', () => {
    for (const element of ELEMENTS) assert.equal(isElement(element), true)
    assert.equal(isElement('plasma'), false)
    assert.equal(isElement('Ember'), false)
  })

  it('capitalises for display', () => {
    assert.equal(elementName('ember'), 'Ember')
    assert.equal(elementName('umbra'), 'Umbra')
  })

  it('does not throw on an empty string', () => {
    assert.equal(elementName(''), '')
  })
})

describe('THE ELEMENT HUES ARE ART DIRECTION, NOT AN INTERFACE PALETTE', () => {
  /**
   * Perceptual distance, approximated well enough to make a point.
   *
   * Not a full CIEDE2000 — importing a colour-science library into a game client's test suite to
   * prove a design constraint would be exactly the "the bundle ballooned because a menu needed a
   * library" failure, one directory over. A weighted RGB distance is enough to demonstrate that
   * two of these pairs sit an order of magnitude closer together than the estate's validated
   * categorical palette does.
   */
  function distance(a: string, b: string): number {
    const parse = (hex: string): [number, number, number] => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ]
    const [r1, g1, b1] = parse(a)
    const [r2, g2, b2] = parse(b)
    const rm = (r1 + r2) / 2
    return Math.sqrt(
      (2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2,
    )
  }

  const hues = Object.fromEntries(ELEMENTS.map((e) => [e, accentFor('types', e)])) as Record<string, string>

  it('records an accent for every element', () => {
    for (const element of ELEMENTS) assert.ok(hues[element], `${element} has no recorded accent`)
  })

  /**
   * `ui/packages/ui/src/tokens.css:211-218` — the eight validated categorical slots, whose stated
   * guarantee is ADJACENT separation, "assigned in this order and NEVER cycled". Its worst
   * adjacent pair is the bar this measures against.
   */
  const VIZ = ['#e8622c', '#2a9e93', '#ad8418', '#2494b4', '#7d5ce0', '#cc5384', '#3d7ed6', '#4f9c40']

  function worstAdjacent(palette: readonly string[]): number {
    let worst = Number.POSITIVE_INFINITY
    for (let i = 1; i < palette.length; i += 1) {
      worst = Math.min(worst, distance(palette[i - 1] as string, palette[i] as string))
    }
    return worst
  }

  it('has five all-pairs distances below what the validated palette guarantees adjacently', () => {
    // A type chip is not a vertical list: any two can sit side by side in a dual-type species or a
    // filter row, so ALL PAIRS have to separate, not just neighbours. Measured that way the nine
    // fail repeatedly — which is the finding, not a complaint about the art.
    const bar = worstAdjacent(VIZ)
    const pairs: [string, string, number][] = []
    for (let i = 0; i < ELEMENTS.length; i += 1) {
      for (let j = i + 1; j < ELEMENTS.length; j += 1) {
        const a = ELEMENTS[i] as string
        const b = ELEMENTS[j] as string
        pairs.push([a, b, distance(hues[a] as string, hues[b] as string)])
      }
    }
    const failing = pairs.filter(([, , d]) => d < bar)
    assert.ok(
      failing.length >= 5,
      `only ${failing.length} pairs fall below the ${bar.toFixed(0)} bar; the premise has changed`,
    )
  })

  it('has frost and gale at roughly a QUARTER of that bar — the worst pair', () => {
    const bar = worstAdjacent(VIZ)
    const close = distance(hues['frost'] as string, hues['gale'] as string)
    assert.ok(
      close < bar / 3,
      `frost/gale measure ${close.toFixed(0)} against a validated adjacent bar of ${bar.toFixed(0)}`,
    )
  })

  it('is not measuring a broken function — two obviously different hues are far apart', () => {
    // Without this, a distance() that returned 0 for everything would make both assertions above
    // pass triumphantly.
    assert.ok(distance('#ffffff', '#000000') > 400)
    assert.ok(distance('#ff6b4a', '#ff6b4a') === 0)
  })
})

describe('typeChip — icon and label are never optional', () => {
  it('always carries a written label', () => {
    for (const element of ELEMENTS) {
      assert.ok(typeChip(element).label.length > 0, `${element} produced a chip with no label`)
    }
  })

  it('carries an icon for every known element', () => {
    for (const element of ELEMENTS) {
      assert.ok(typeChip(element).icon, `${element} produced a chip with no icon`)
      assert.equal(typeChip(element).known, true)
    }
  })

  it('STILL carries a label for an element it has no icon for', () => {
    // A species whose type this build predates renders its name without an icon, rather than a
    // broken image or — far worse — a bare coloured dot.
    const chip = typeChip('plasma')
    assert.equal(chip.icon, null)
    assert.equal(chip.known, false)
    assert.equal(chip.label, 'Plasma')
  })

  it('has no field that would let a component render colour alone', () => {
    const chip = typeChip('ember')
    assert.deepEqual(Object.keys(chip).sort(), ['element', 'icon', 'known', 'label', 'tint'])
    // `tint` is nullable and decorative; `label` is a plain non-empty string on every path above.
    assert.equal(typeof chip.label, 'string')
  })

  it('the component never suppresses the label', () => {
    // Read as text, because this suite has no DOM. The rule is that `ek-type__label` is rendered
    // unconditionally; a `{showLabel && …}` would be the regression.
    const source = read('src/components/kin.tsx')
    assert.ok(source.includes('ek-type__label'), 'the type chip no longer renders a label')
    assert.ok(!/showLabel|labelless|iconOnly/.test(source), 'a way to hide the type label has appeared')
  })
})

describe('the type chart', () => {
  const chart = typesData.chart

  it('is sparse — an absent entry means 1×, not 0×', () => {
    // Reading a missing key as 0 ("no effect") would be a very different game.
    assert.equal(chart['ember']?.['spark'], undefined)
    assert.equal(effectiveness(chart, 'ember', 'spark'), 1)
  })

  it('reads the stated 2× entries', () => {
    assert.equal(effectiveness(chart, 'ember', 'verdant'), 2)
    assert.equal(effectiveness(chart, 'tide', 'ember'), 2)
  })

  it('reads the stated 0.5× entries', () => {
    assert.equal(effectiveness(chart, 'ember', 'tide'), 0.5)
  })

  it('is 1× against an element the chart does not mention at all', () => {
    assert.equal(effectiveness(chart, 'plasma', 'ember'), 1)
    assert.equal(effectiveness(chart, 'ember', 'plasma'), 1)
  })

  it('multiplies across a dual-type defender', () => {
    // ember is 2× on verdant and 0.5× on tide, so a verdant/tide defender takes 1×.
    assert.equal(effectivenessAgainst(chart, 'ember', ['verdant', 'tide']), 1)
    // 2× on verdant and 2× on frost stacks to 4×.
    assert.equal(effectivenessAgainst(chart, 'ember', ['verdant', 'frost']), 4)
  })

  it('is 1× against no types at all, rather than 0×', () => {
    assert.equal(effectivenessAgainst(chart, 'ember', []), 1)
  })

  it('names every element the chart mentions', () => {
    const known = new Set(ELEMENTS as readonly string[])
    for (const [attacker, row] of Object.entries(chart)) {
      assert.ok(known.has(attacker), `${attacker} attacks but is not an element`)
      for (const defender of Object.keys(row)) {
        assert.ok(known.has(defender), `${defender} is defended against but is not an element`)
      }
    }
  })
})

describe('effectivenessLabel — words, never a colour', () => {
  it('says it plainly at each step', () => {
    assert.equal(effectivenessLabel(0), 'No effect')
    assert.equal(effectivenessLabel(0.25), 'Barely scratches')
    assert.equal(effectivenessLabel(0.5), 'Not very effective')
    assert.equal(effectivenessLabel(1), 'Normal damage')
    assert.equal(effectivenessLabel(2), 'Super effective')
    assert.equal(effectivenessLabel(4), 'Devastating')
  })

  it('gives every multiplier a non-empty phrase', () => {
    for (const m of [0, 0.25, 0.5, 1, 2, 4, 8]) {
      assert.ok(effectivenessLabel(m).length > 0, `${m} has no phrase`)
    }
  })

  it('distinguishes 0 from 0.25 — "no effect" and "resisted" are different facts', () => {
    assert.notEqual(effectivenessLabel(0), effectivenessLabel(0.25))
  })
})
