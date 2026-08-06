/**
 * Items, transcribed from `emberkin/src/engine/items.ts` — which is a hard-coded switch, not data.
 *
 * There is no items JSON and no route that serves one, so this client's copy is a transcription
 * and the test's job is to pin it line by line against the source it was transcribed from.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CATEGORY_LABELS,
  categoryOf,
  curesStatus,
  healAmount,
  isResonator,
  itemEffect,
  itemName,
  RESONATORS,
} from '../src/lib/items.ts'

describe('the resonators — engine/items.ts', () => {
  it('are the three grades', () => {
    assert.deepEqual([...RESONATORS], ['resonator', 'greater_resonator', 'master_resonator'])
  })

  it('are recognised, and nothing else is', () => {
    for (const id of RESONATORS) assert.equal(isResonator(id), true)
    assert.equal(isResonator('potion'), false)
    assert.equal(isResonator('resonator_x'), false)
  })
})

describe('healAmount — engine/items.ts', () => {
  it('reads the four potions', () => {
    assert.equal(healAmount('potion'), 40)
    assert.equal(healAmount('super_potion'), 90)
    assert.equal(healAmount('hyper_potion'), 160)
    assert.equal(healAmount('max_potion'), 99999)
  })

  it('is zero for anything else — engine/items.ts `default: return 0`', () => {
    assert.equal(healAmount('salve'), 0)
    assert.equal(healAmount('resonator'), 0)
    assert.equal(healAmount('nothing'), 0)
  })
})

describe('curesStatus — engine/items.ts', () => {
  it('is salve and full_heal', () => {
    assert.equal(curesStatus('salve'), true)
    assert.equal(curesStatus('full_heal'), true)
  })

  it('is nothing else', () => {
    assert.equal(curesStatus('potion'), false)
    assert.equal(curesStatus('max_potion'), false)
  })
})

describe('itemName — engine/items.ts', () => {
  it('reads the nine display names', () => {
    assert.equal(itemName('potion'), 'Potion')
    assert.equal(itemName('super_potion'), 'Super Potion')
    assert.equal(itemName('hyper_potion'), 'Hyper Potion')
    assert.equal(itemName('max_potion'), 'Max Potion')
    assert.equal(itemName('salve'), 'Salve')
    assert.equal(itemName('full_heal'), 'Full Heal')
    assert.equal(itemName('resonator'), 'Resonator')
    assert.equal(itemName('greater_resonator'), 'Greater Resonator')
    assert.equal(itemName('master_resonator'), 'Master Resonator')
  })

  it('FALLS THROUGH TO THE ID, exactly as engine/items.ts does', () => {
    // A new item added to the service shows up in the satchel as its id rather than vanishing from
    // a screen that is supposed to list everything you are carrying.
    assert.equal(itemName('shard_lantern'), 'shard_lantern')
  })
})

describe('itemEffect', () => {
  it('states a heal in HP', () => {
    assert.equal(itemEffect('potion'), 'Restores 40 HP.')
    assert.equal(itemEffect('hyper_potion'), 'Restores 160 HP.')
  })

  it('says "fully" for max_potion rather than printing 99999', () => {
    // 99999 is a sentinel standing in for "all of it"; printing it would be printing an
    // implementation detail as a number.
    assert.equal(itemEffect('max_potion'), 'Restores a Kin fully.')
    assert.ok(!itemEffect('max_potion')?.includes('99999'))
  })

  it('states the status cure', () => {
    assert.match(itemEffect('salve') ?? '', /status/i)
  })

  it('grades the resonators without printing the 255 sentinel', () => {
    assert.match(itemEffect('resonator') ?? '', /baseline/)
    assert.match(itemEffect('greater_resonator') ?? '', /better/)
    assert.match(itemEffect('master_resonator') ?? '', /guaranteed/)
    assert.ok(!itemEffect('master_resonator')?.includes('255'))
  })

  it('is NULL for an unknown item — "unknown" is not "no effect"', () => {
    assert.equal(itemEffect('shard_lantern'), null)
  })
})

describe('categoryOf', () => {
  it('sorts each family', () => {
    assert.equal(categoryOf('resonator'), 'resonator')
    assert.equal(categoryOf('potion'), 'healing')
    assert.equal(categoryOf('salve'), 'status')
    assert.equal(categoryOf('shard_lantern'), 'other')
  })

  it('gives every category a label', () => {
    for (const id of ['resonator', 'potion', 'salve', 'shard_lantern']) {
      assert.ok(CATEGORY_LABELS[categoryOf(id)].length > 0)
    }
  })
})
