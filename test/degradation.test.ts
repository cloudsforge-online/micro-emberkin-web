/**
 * Degradation, not blank pages — rule 3 of the brief, driven through every branch.
 *
 * Four sources load independently: the content in this build, the species list, the save, and what
 * the account owns. One of them being down must render the other three and NAME the missing one.
 *
 * The reverse mistake is guarded here too, and it is the one that does real harm: a FAILED load
 * must never render as an EMPTY one. A wardrobe that could not reach billing says "we could not
 * check what you own", never "you own nothing" — the second is a false statement about a purchase,
 * and a player who bought a cosmetic yesterday will read it as a theft.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeMissing, type Source } from '../src/lib/game.tsx'
import { joinWords } from '../src/components/shell.tsx'
import { resourceState } from '../src/lib/resource.ts'
import type { SaveMachine } from '../src/lib/save.ts'

const ok = <T,>(data: T): Source<T> => ({ status: 'ready', data, error: null })
const loading: Source<never> = { status: 'loading', data: null, error: null }
const failed: Source<never> = {
  status: 'failed',
  data: null,
  error: { message: 'nope', requestId: 'req-1', forbidden: false },
}

const present: SaveMachine = {
  status: 'present',
  save: {
    userId: 'u',
    wardenName: 'Ash',
    seed: '1',
    currentRegion: 'emberfall_vale',
    storyProgress: 0,
    playtimeSeconds: 0,
    party: [],
    box: [],
    inventory: {},
    seals: [],
    dexSeen: [],
    equippedCosmetics: {},
    saveVersion: 1,
  },
}
const brokenSave: SaveMachine = {
  status: 'failed',
  notice: { message: 'nope', requestId: 'req-2', forbidden: false },
}

describe('describeMissing — all sixteen combinations', () => {
  it('names nothing when all four answered', () => {
    assert.deepEqual(
      describeMissing({ content: ok(1), dex: ok(1), entitlements: ok(1), save: present }),
      [],
    )
  })

  it('names nothing while they are still loading — waiting is not missing', () => {
    assert.deepEqual(
      describeMissing({ content: loading, dex: loading, entitlements: loading, save: { status: 'loading' } }),
      [],
    )
  })

  it('names nothing for an ABSENT save — a first-time player has lost nothing', () => {
    assert.deepEqual(
      describeMissing({ content: ok(1), dex: ok(1), entitlements: ok(1), save: { status: 'absent' } }),
      [],
    )
  })

  it('names the content when only the content failed', () => {
    assert.deepEqual(
      describeMissing({ content: failed, dex: ok(1), entitlements: ok(1), save: present }),
      ['the game content in this build'],
    )
  })

  it('names the species list when only the dex failed', () => {
    assert.deepEqual(
      describeMissing({ content: ok(1), dex: failed, entitlements: ok(1), save: present }),
      ['the species list'],
    )
  })

  it('names the save when only the save failed', () => {
    assert.deepEqual(
      describeMissing({ content: ok(1), dex: ok(1), entitlements: ok(1), save: brokenSave }),
      ['your save'],
    )
  })

  it('names what the account owns when only billing failed', () => {
    assert.deepEqual(
      describeMissing({ content: ok(1), dex: ok(1), entitlements: failed, save: present }),
      ['what your account owns'],
    )
  })

  it('names all four when all four failed', () => {
    const missing = describeMissing({
      content: failed,
      dex: failed,
      entitlements: failed,
      save: brokenSave,
    })
    assert.equal(missing.length, 4)
  })

  it('exhausts every combination of the four, and never throws', () => {
    // Sixteen states, driven rather than argued about. The assertion is that the count of named
    // things always equals the count of failed sources — which is what "names what is missing"
    // means, precisely.
    const sources: readonly Source<number>[] = [ok(1), failed]
    const saves: readonly SaveMachine[] = [present, brokenSave]
    let combinations = 0
    for (const content of sources) {
      for (const dex of sources) {
        for (const entitlements of sources) {
          for (const save of saves) {
            combinations += 1
            const expected: number =
              (content === failed ? 1 : 0) +
              (dex === failed ? 1 : 0) +
              (entitlements === failed ? 1 : 0) +
              (save === brokenSave ? 1 : 0)
            assert.equal(describeMissing({ content, dex, entitlements, save }).length, expected)
          }
        }
      }
    }
    assert.equal(combinations, 16)
  })

  it('names the thing the player lost, not the service that lost it', () => {
    // "micro-emberkin is unavailable" is not information to somebody trying to play a game. The
    // request id in the failure state is what an engineer needs, and it is shown there.
    const missing = describeMissing({ content: failed, dex: failed, entitlements: failed, save: brokenSave })
    for (const phrase of missing) {
      assert.ok(!phrase.includes('micro-'), `"${phrase}" names a service`)
      assert.ok(!phrase.includes('emberkin'), `"${phrase}" names a service`)
      assert.ok(!phrase.includes('billing'), `"${phrase}" names a service`)
    }
  })
})

describe('the banner wording', () => {
  it('is empty for nothing', () => {
    assert.equal(joinWords([]), '')
  })

  it('is the bare phrase for one', () => {
    assert.equal(joinWords(['your save']), 'your save')
  })

  it('joins two with "and"', () => {
    assert.equal(joinWords(['your save', 'the species list']), 'your save and the species list')
  })

  it('joins three with commas and a final "and"', () => {
    assert.equal(joinWords(['a', 'b', 'c']), 'a, b and c')
  })

  it('joins four the same way — the case nobody checks until the day it happens', () => {
    assert.equal(joinWords(['a', 'b', 'c', 'd']), 'a, b, c and d')
  })
})

describe('resourceState — failure outranks emptiness, in both directions', () => {
  it('is loading before anything answered', () => {
    assert.equal(resourceState({ loading: true, error: null, count: null }), 'loading')
  })

  it('is ok with data', () => {
    assert.equal(resourceState({ loading: false, error: null, count: 3 }), 'ok')
  })

  it('is empty for a genuine zero', () => {
    assert.equal(resourceState({ loading: false, error: null, count: 0 }), 'empty')
  })

  it('is FAILED, not empty, when the request threw — an outage must not read as a quiet week', () => {
    assert.equal(
      resourceState({ loading: false, error: { message: 'x', requestId: undefined, forbidden: false }, count: 0 }),
      'failed',
    )
  })

  it('is failed even while still loading, because an error already tells us more', () => {
    assert.equal(
      resourceState({ loading: true, error: { message: 'x', requestId: undefined, forbidden: false }, count: null }),
      'failed',
    )
  })

  it('is FORBIDDEN rather than failed on a 403 — the two have different remedies', () => {
    assert.equal(
      resourceState({ loading: false, error: { message: 'x', requestId: undefined, forbidden: true }, count: 0 }),
      'forbidden',
    )
  })
})
