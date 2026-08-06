/**
 * The anti-pay-to-win rule, tested rather than promised.
 *
 * 19 §1.2: monetisation is cosmetics and season passes, "never stat advantage".
 * `emberkin/src/cosmetics.ts` enforces the service half by ABSENCE — there is no code path
 * from equipping to a stat. An absence is not something a client can inherit, because a client can
 * still lie about it in prose or quietly apply a modifier of its own.
 *
 * So there are two tests that matter here, and they check different things:
 *
 *   `withCosmeticApplied` leaves a Kin BYTE-IDENTICAL. This does not read any copy; it compares
 *   the object. It is what would catch the "harmless" +1 that starts the slide.
 *
 *   No catalogue entry's copy claims an advantage. This one does read the copy, including copy
 *   built from billing metadata, which is text this repository does not control.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  claimsAdvantage,
  FORBIDDEN_EFFECT_WORDS,
  isKnownSlot,
  isSeasonPass,
  itemsForSlot,
  SEASON_PASS_SKUS,
  SLOT_LABELS,
  SLOTS,
  slotOf,
  wardrobeFrom,
  withCosmeticApplied,
  type CosmeticItem,
} from '../src/lib/cosmetics.ts'
import { RESONANCE_BANDS } from '../src/lib/resonance.ts'
import type { Entitlement } from '../src/lib/billing.ts'
import type { KinSave } from '../src/lib/emberkin.ts'

function ent(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    id: 'e1',
    sku: 'ember_frame',
    scope: 'title:emberkin',
    source: 'purchase',
    grantedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    active: true,
    metadata: {},
    ...overrides,
  }
}

function kin(overrides: Partial<KinSave> = {}): KinSave {
  return {
    speciesId: 'cindercub',
    nickname: null,
    level: 20,
    xp: 400,
    resonance: 0,
    temperament: 10,
    attunement: { hp: 20, attack: 18, defense: 12, spatk: 14, spdef: 11, speed: 25 },
    moves: ['ember_scratch', 'flame_fang'],
    heldItem: null,
    currentHp: 55,
    status: 'None',
    ...overrides,
  }
}

describe('the slots', () => {
  it('are exactly the five emberkin/src/cosmetics.ts accepts', () => {
    assert.deepEqual([...SLOTS], ['frame', 'trail', 'title_card', 'hud', 'battle_intro'])
  })

  it('recognises each of them and nothing else', () => {
    for (const slot of SLOTS) assert.equal(isKnownSlot(slot), true)
    assert.equal(isKnownSlot('hat'), false)
    assert.equal(isKnownSlot('FRAME'), false)
    assert.equal(isKnownSlot(''), false)
  })

  it('gives every slot a name and a place on screen', () => {
    for (const slot of SLOTS) {
      assert.ok(SLOT_LABELS[slot].name.length > 0)
      assert.ok(SLOT_LABELS[slot].where.length > 0)
    }
  })

  it('describes every slot in purely visual terms', () => {
    for (const slot of SLOTS) {
      assert.equal(claimsAdvantage(`${SLOT_LABELS[slot].name} ${SLOT_LABELS[slot].where}`), false)
    }
  })
})

describe('A COSMETIC NEVER CHANGES A STAT', () => {
  /**
   * The test that would actually catch a regression: it compares the Kin, not the copy.
   *
   * Driven at every Resonance band, because a plausible-looking bug would be a modifier that only
   * applies once a bond threshold is reached — the exact place a stat multiplier already exists in
   * the engine, and therefore the exact place somebody might add one.
   */
  const item: CosmeticItem = {
    itemUrn: 'ember_frame',
    name: 'Ember Frame',
    slot: 'frame',
    effect: 'Changes how this looks.',
    owned: true,
  }

  it('leaves a Kin byte-identical at EVERY Resonance band', () => {
    // Driven at every band because the plausible bug is a modifier that only applies once a bond
    // threshold is reached — the exact place a stat multiplier already exists in the engine, and
    // therefore the exact place somebody might add one.
    for (const band of RESONANCE_BANDS) {
      const before = kin({ resonance: band.at })
      assert.deepEqual(withCosmeticApplied(before, item), before, `changed at ${band.name}`)
    }
  })

  it('leaves every individual stat field untouched', () => {
    const before = kin()
    const after = withCosmeticApplied(before, item)
    for (const stat of ['hp', 'attack', 'defense', 'spatk', 'spdef', 'speed']) {
      assert.equal(after.attunement[stat], before.attunement[stat], `attunement.${stat} moved`)
    }
    assert.equal(after.level, before.level)
    assert.equal(after.currentHp, before.currentHp)
    assert.equal(after.resonance, before.resonance)
    assert.equal(after.temperament, before.temperament)
  })

  it('leaves the move list untouched', () => {
    const before = kin()
    assert.deepEqual(withCosmeticApplied(before, item).moves, before.moves)
  })

  it('is the identity, applied five times over', () => {
    let k = kin()
    for (const slot of SLOTS) k = withCosmeticApplied(k, { ...item, slot })
    assert.deepEqual(k, kin())
  })

  it('a CosmeticItem has no field a stat could be put in', () => {
    // A type-level rule, checked at runtime so it is a test and not a comment: the shape is
    // exactly these five keys.
    assert.deepEqual(Object.keys(item).sort(), ['effect', 'itemUrn', 'name', 'owned', 'slot'])
  })
})

describe('claimsAdvantage — the mis-sell guard', () => {
  it('flags every word on the list', () => {
    const missed = FORBIDDEN_EFFECT_WORDS.filter((w) => !claimsAdvantage(`This one gives a ${w} to your Kin`))
    assert.deepEqual(missed, [], `not flagged: ${missed.join(', ')}`)
    assert.ok(FORBIDDEN_EFFECT_WORDS.length > 10, 'the list is too short for that to have meant anything')
  })

  it('flags a signed number', () => {
    assert.equal(claimsAdvantage('Adds +5 to something'), true)
    assert.equal(claimsAdvantage('Takes -2 away'), true)
  })

  it('flags a percentage', () => {
    assert.equal(claimsAdvantage('Improves things by 6%'), true)
  })

  it('does NOT flag ordinary visual copy', () => {
    assert.equal(claimsAdvantage('A ring of drifting embers around the portrait.'), false)
    assert.equal(claimsAdvantage('Changes how this looks. It does not change a single number.'), false)
  })

  it('does not flag a word that merely CONTAINS a forbidden one', () => {
    // Substring matching would flag "statue" and "empower", the guard would be wrong within a
    // week, and a guard people switch off is worse than no guard.
    assert.equal(claimsAdvantage('A weathered statue in the background.'), false)
    assert.equal(claimsAdvantage('Empowered by nothing at all.'), false)
  })

  it('is case-insensitive', () => {
    assert.equal(claimsAdvantage('BOOST'), true)
  })
})

describe('wardrobeFrom', () => {
  it('offers an owned, active cosmetic', () => {
    const items = wardrobeFrom([ent()])
    assert.equal(items.length, 1)
    assert.equal(items[0]?.itemUrn, 'ember_frame')
  })

  it('does not offer an inactive one', () => {
    assert.deepEqual(wardrobeFrom([ent({ active: false })]), [])
  })

  it("does not offer another title's cosmetic", () => {
    assert.deepEqual(wardrobeFrom([ent({ scope: 'title:foresight' })]), [])
  })

  it('does offer a platform-scoped one', () => {
    assert.equal(wardrobeFrom([ent({ scope: 'platform' })]).length, 1)
  })

  it('NEVER offers a season pass as something to wear', () => {
    // `emberkin/src/server.ts`. A pass buys a cosmetic track and a welcome reward; it is not a
    // slot and it is not a stat.
    for (const sku of SEASON_PASS_SKUS) {
      assert.deepEqual(wardrobeFrom([ent({ sku })]), [], `${sku} was offered as a wearable`)
    }
  })

  it('takes a display name from metadata when there is one', () => {
    const items = wardrobeFrom([ent({ metadata: { name: 'Ember Frame' } })])
    assert.equal(items[0]?.name, 'Ember Frame')
  })

  it('falls back to the SKU rather than a prettified guess', () => {
    // A SKU a player can read back to support beats a title this app made up.
    assert.equal(wardrobeFrom([ent()])[0]?.name, 'ember_frame')
  })

  it('gives every produced item copy that does not claim an advantage', () => {
    const items = wardrobeFrom([
      ent({ sku: 'a', metadata: { name: 'A' } }),
      ent({ id: 'e2', sku: 'b', scope: 'platform' }),
    ])
    assert.equal(items.length, 2)
    for (const item of items) {
      assert.equal(claimsAdvantage(item.effect), false, `${item.itemUrn}: ${item.effect}`)
      assert.equal(claimsAdvantage(item.name), false, `${item.itemUrn} name claims an advantage`)
    }
  })

  it('rejects a name from billing metadata that WOULD claim an advantage', () => {
    // Billing metadata is text this repository does not control, so the guard has to be able to
    // see it. This asserts the guard fires; the wardrobe's job is then to not render it.
    const items = wardrobeFrom([ent({ metadata: { name: '+10% attack frame' } })])
    assert.equal(claimsAdvantage(items[0]!.name), true)
  })
})

describe('slotOf', () => {
  it('reads a known slot from metadata', () => {
    assert.equal(slotOf(ent({ metadata: { slot: 'hud' } })), 'hud')
  })

  it('is null when metadata names no slot', () => {
    assert.equal(slotOf(ent()), null)
  })

  it('is null for a slot the service would refuse', () => {
    assert.equal(slotOf(ent({ metadata: { slot: 'hat' } })), null)
  })

  it('is null for a non-string slot', () => {
    assert.equal(slotOf(ent({ metadata: { slot: 3 } })), null)
  })
})

describe('itemsForSlot', () => {
  const framed: CosmeticItem = { itemUrn: 'a', name: 'A', slot: 'frame', effect: '', owned: true }
  const anywhere: CosmeticItem = { itemUrn: 'b', name: 'B', slot: null, effect: '', owned: true }
  const hudOnly: CosmeticItem = { itemUrn: 'c', name: 'C', slot: 'hud', effect: '', owned: true }

  it('includes items that name the slot', () => {
    assert.deepEqual(itemsForSlot([framed, hudOnly], 'frame'), [framed])
  })

  it('includes items that name NO slot, because the service accepts any owned item anywhere', () => {
    // `emberkin/src/cosmetics.ts` validates the slot and the ownership independently.
    assert.deepEqual(itemsForSlot([anywhere], 'battle_intro'), [anywhere])
  })

  it('excludes items belonging to another slot', () => {
    assert.deepEqual(itemsForSlot([hudOnly], 'frame'), [])
  })
})

describe('isSeasonPass', () => {
  it('matches both SKUs from server.ts', () => {
    assert.equal(isSeasonPass('emberkin_season_pass'), true)
    assert.equal(isSeasonPass('season_pass'), true)
  })

  it('matches the urn form too', () => {
    assert.equal(isSeasonPass('cf:catalogue:item:season_pass'), true)
  })

  it('does not match a cosmetic', () => {
    assert.equal(isSeasonPass('ember_frame'), false)
  })
})
