/**
 * The nine elements, and the reason none of them is ever shown as a colour alone.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * A CORRECTION TO A PREMISE, WRITTEN DOWN SO IT IS NOT REPEATED.
 *
 * The brief said "the type palette is CVD-corrected in `ui/` — use it". It is not there. `micro-ui`
 * carries the five product accents and the eight-slot categorical VIZ palette
 * (`ui/packages/ui/src/tokens.css`), both validated for colour-vision deficiency, and
 * neither is an element palette; `SurfaceKey` has no Emberkin entry at all. The nine element hues
 * that DO exist are art-direction values recorded per icon in the asset manifest — ember `#ff6b4a`,
 * frost `#8ee7ff`, gale `#9fd0ff`, lumen `#ffe59e`, spark `#ffd23f`, stone `#c9a06b`, tide
 * `#4aa8ff`, umbra `#9a7bd6`, verdant `#5fce7a` — and as a SET they are not separable:
 * frost/gale differ by roughly one channel step in blue, and lumen/spark are the same yellow at
 * two lightnesses. They are correct for painting a creature and wrong for labelling one.
 *
 * `ui/packages/ui/src/tokens.css` states the estate's rule for exactly this case: "never
 * colour alone: every status mark ships icon + label + colour". So a type in this client is
 * ALWAYS a generated icon plus its written name; the hue is a tint behind them and carries no
 * information on its own. `typeChip()` is the single constructor for that, it cannot produce a
 * chip without a label and an icon slug, and `test/types.test.ts` asserts it — including a test
 * that the palette really is inseparable, so nobody "simplifies" the chip back to a dot later.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import { accentFor, typeIcon } from './art.ts'

/**
 * The nine elements, in `types.json`'s own order.
 *
 * `public/game/data/types.json` `elements`, carried forward from `kindred-resonance`
 * `content/types.json`. The service's canonical copy is `emberkin/src/content/gamedata.ts`; this
 * is the rendering copy, and `content.ts` reconciles the two.
 */
export const ELEMENTS = [
  'ember',
  'tide',
  'verdant',
  'gale',
  'stone',
  'spark',
  'frost',
  'umbra',
  'lumen',
] as const
export type Element = (typeof ELEMENTS)[number]

export function isElement(value: string): value is Element {
  return (ELEMENTS as readonly string[]).includes(value)
}

/** Capitalised for display. Element ids are lowercase on the wire and in the type chart. */
export function elementName(element: string): string {
  return element.charAt(0).toUpperCase() + element.slice(1)
}

/**
 * Everything needed to render a type, with no way to render it as colour alone.
 *
 * `label` and `icon` are non-optional. `tint` is nullable and decorative. A component handed one of
 * these cannot accidentally draw a bare swatch, because there is nothing in it that would let it.
 */
export interface TypeChip {
  readonly element: string
  readonly label: string
  /** The generated 512×512 icon, or null when the element has none. */
  readonly icon: string | null
  /** Art accent. Decorative only — see the header. */
  readonly tint: string | null
  /**
   * Whether this element is one the art set covers. False means the service knows an element this
   * bundle does not, and the chip renders its name without an icon rather than a broken image.
   */
  readonly known: boolean
}

export function typeChip(element: string): TypeChip {
  const icon = typeIcon(element)
  return {
    element,
    label: elementName(element),
    icon,
    tint: accentFor('types', element),
    known: icon !== null,
  }
}

/**
 * The type chart, as the effectiveness of `attacker` against `defender`.
 *
 * `public/game/data/types.json` `chart`, which is SPARSE: an absent entry means 1× (neutral), and
 * a `0.5` or `2` is stated. Reading a missing key as 0 — "no effect" — would be a very different
 * game, so the default is explicit here rather than relying on a nullish operator further out.
 *
 * This is display only. Damage is computed server-side (`emberkin/src/engine/damage.ts`); this
 * exists so a player choosing a move can see what it will do, which is the information the whole
 * type system is for.
 */
export type TypeChart = Readonly<Record<string, Readonly<Record<string, number>>>>

export function effectiveness(chart: TypeChart, attacker: string, defender: string): number {
  return chart[attacker]?.[defender] ?? 1
}

/** Against a multi-type defender, effectiveness multiplies. */
export function effectivenessAgainst(chart: TypeChart, attacker: string, defenders: readonly string[]): number {
  return defenders.reduce((acc, d) => acc * effectiveness(chart, attacker, d), 1)
}

/**
 * How an effectiveness multiplier is said out loud.
 *
 * Words, not a colour and not a number of arrows. A player who cannot see the red glow still needs
 * to know the move is resisted, and "Not very effective" is how every game in this genre has said
 * it for thirty years.
 */
export function effectivenessLabel(multiplier: number): string {
  if (multiplier === 0) return 'No effect'
  if (multiplier >= 4) return 'Devastating'
  if (multiplier > 1) return 'Super effective'
  if (multiplier === 1) return 'Normal damage'
  if (multiplier > 0.3) return 'Not very effective'
  return 'Barely scratches'
}
