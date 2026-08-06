/**
 * Cosmetics: what may be worn, and the rule that none of it changes a stat.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE PRODUCT RULE, AND HOW IT IS ENFORCED HERE.
 *
 * docs/ecosystem/19-new-products.md §1.2: monetisation is "cosmetics and season passes through
 * billing entitlements, **never stat advantage**". `emberkin/src/cosmetics.ts` states the
 * service half and enforces it by ABSENCE — equipping writes `saves.equipped_cosmetics` and
 * nothing else, and the engine reads stats from species base stats, per-instance Attunement and
 * Resonance, none of which a cosmetic can reach.
 *
 * An absence in the service is not enough for a client, because a client can lie about it in
 * prose. So the rule is expressed here as a TYPE and a test: a `CosmeticItem` has no stat field to
 * populate, its `effect` copy is drawn from a closed vocabulary of purely visual verbs, and
 * `test/cosmetics.test.ts` asserts that no catalogue entry's copy contains a stat word and that
 * applying any cosmetic to a Kin leaves every one of its numbers identical. That last test is the
 * one that would actually catch a regression: it does not read the copy, it compares the Kin.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import type { KinSave } from './emberkin.ts'
import { owns, skuOf, TITLE_SCOPE, type Entitlement } from './billing.ts'

/**
 * The slots the service will accept.
 *
 * `emberkin/src/cosmetics.ts` — `const KNOWN_SLOTS = new Set(['frame', 'trail', 'title_card',
 * 'hud', 'battle_intro'])`. Anything else is a `ValidationError`, which
 * `emberkin/src/server.ts` maps to a 400. Kept in this order, and asserted against the
 * service's own list in the test, so the wardrobe cannot offer a slot that does not exist.
 */
export const SLOTS = ['frame', 'trail', 'title_card', 'hud', 'battle_intro'] as const
export type CosmeticSlot = (typeof SLOTS)[number]

export function isKnownSlot(slot: string): slot is CosmeticSlot {
  return (SLOTS as readonly string[]).includes(slot)
}

/** What a slot is called, and what part of the screen it dresses. */
export const SLOT_LABELS: Readonly<Record<CosmeticSlot, { name: string; where: string }>> = {
  frame: { name: 'Portrait frame', where: 'The border around a Kin portrait.' },
  trail: { name: 'Trail', where: 'The motes a Kin leaves as it moves.' },
  title_card: { name: 'Title card', where: 'The card shown when you introduce yourself.' },
  hud: { name: 'HUD skin', where: 'The battle interface chrome.' },
  battle_intro: { name: 'Battle intro', where: 'The flourish as a battle opens.' },
}

/**
 * One wearable thing.
 *
 * There is no `statBonus`, no `modifiers`, no `power` — and there is nowhere to put one. A
 * cosmetic in this app is a slot, a name and a picture. That is the anti-pay-to-win rule expressed
 * as a type rather than as a comment, which is the only version of it a compiler can hold you to.
 */
export interface CosmeticItem {
  /** The item urn or bare SKU, as billing knows it. See `skuOf`. */
  readonly itemUrn: string
  readonly name: string
  /** The slot it is worn in. Null when the entitlement did not say; see `slotOf`. */
  readonly slot: CosmeticSlot | null
  /** Purely visual copy. Vetted by `test/cosmetics.test.ts` against a forbidden-word list. */
  readonly effect: string
  readonly owned: boolean
}

/**
 * The slot an entitlement names, if it names one.
 *
 * Billing carries free-form `metadata` (`billing/src/entitlements.ts`), and the catalogue
 * convention is a `slot` key. Nothing in the estate REQUIRES it, so an entitlement without one is
 * not an error: it becomes a cosmetic offered in every slot, and the service accepts any owned
 * item in any known slot (`emberkin/src/cosmetics.ts` validates the slot and the ownership
 * independently). Guessing a slot from the SKU's spelling would be inventing data.
 */
export function slotOf(entitlement: Entitlement): CosmeticSlot | null {
  const raw = entitlement.metadata['slot']
  return typeof raw === 'string' && isKnownSlot(raw) ? raw : null
}

/**
 * The season pass SKUs, which are NOT cosmetics and are never offered in a slot.
 *
 * `emberkin/src/server.ts` — `const SEASON_PASS_SKUS = new Set(['emberkin_season_pass',
 * 'season_pass'])`. A pass is an entitlement like any other, so it turns up in the same list; it
 * buys a season's cosmetic track and a welcome reward (`server.ts`), not a slot and not a
 * stat. Filtering it out of the wardrobe stops it being rendered as something to wear.
 */
export const SEASON_PASS_SKUS: readonly string[] = ['emberkin_season_pass', 'season_pass']

export function isSeasonPass(itemUrn: string): boolean {
  return SEASON_PASS_SKUS.includes(skuOf(itemUrn))
}

/**
 * Turn the entitlement list into a wardrobe.
 *
 * The catalogue IS the entitlement list, deliberately. `micro-emberkin` publishes no cosmetic
 * catalogue route, so this app cannot show "here is everything, and here is what you are missing"
 * without inventing the list — and an invented catalogue is an advertisement written by the
 * client. What it can show honestly is what the account owns, which is also the only set the
 * service will let anyone equip.
 *
 * `name` falls back to the SKU rather than to a prettified guess: a SKU a player can read back to
 * support beats a title this app made up.
 */
export function wardrobeFrom(entitlements: readonly Entitlement[], title: string = TITLE_SCOPE): CosmeticItem[] {
  return entitlements
    .filter((e) => e.active)
    .filter((e) => !isSeasonPass(e.sku))
    .filter((e) => owns(entitlements, e.sku, title))
    .map((e) => ({
      itemUrn: e.sku,
      name: typeof e.metadata['name'] === 'string' ? (e.metadata['name'] as string) : e.sku,
      slot: slotOf(e),
      effect: 'Changes how this looks. It does not change a single number.',
      owned: true,
    }))
}

/** The items offerable in a slot: those that name it, plus those that name none. */
export function itemsForSlot(items: readonly CosmeticItem[], slot: CosmeticSlot): CosmeticItem[] {
  return items.filter((i) => i.slot === slot || i.slot === null)
}

/**
 * A Kin, wearing a cosmetic.
 *
 * The whole function is `return kin`. It exists so that the invariant has a name and an address:
 * `test/cosmetics.test.ts` calls it with every catalogue item against a Kin at every Resonance
 * band and asserts deep equality, which is a test that fails the moment somebody adds the
 * "harmless" +1 that starts the slide. Deleting the function deletes the test, and the CI rule
 * `A cosmetic never touches a stat` fails the build if the test file stops mentioning it.
 */
export function withCosmeticApplied(kin: KinSave, _item: CosmeticItem): KinSave {
  return kin
}

/**
 * Words that must never appear in cosmetic copy shown to a player.
 *
 * Not a style guide — a mis-sell guard. "Boost", "+5%", "stronger" attached to a purchasable item
 * is the claim the product rule forbids, whether or not the code behind it does anything. The test
 * checks `name` and `effect` of every catalogue entry against this list, including entries built
 * from billing metadata, which is text this repository does not control.
 */
export const FORBIDDEN_EFFECT_WORDS: readonly string[] = [
  'stat',
  'stats',
  'boost',
  'buff',
  'damage',
  'attack',
  'defense',
  'defence',
  'speed',
  'power',
  'stronger',
  'advantage',
  'bonus',
  'faster',
  'critical',
]

/**
 * Does this copy claim a mechanical advantage?
 *
 * Word-boundary matched, lowercased. Substring matching would flag "statue" and "empower" and the
 * guard would be turned off within a week for being wrong; a guard people switch off is worse than
 * none.
 */
export function claimsAdvantage(copy: string): boolean {
  const words = copy.toLowerCase().match(/[a-z]+/g) ?? []
  const set = new Set(words)
  if (FORBIDDEN_EFFECT_WORDS.some((w) => set.has(w))) return true
  // A percentage or a signed number next to a purchasable item reads as a stat line regardless of
  // the noun beside it.
  return /[+-]\s*\d/.test(copy) || /\d\s*%/.test(copy)
}
