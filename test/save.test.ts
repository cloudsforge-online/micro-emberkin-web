/**
 * The save state machine, and the battle diff.
 *
 * The state machine's whole reason for existing is that `absent` and `failed` are different
 * things. Collapsing them offers "New game" to a player whose service is merely down — the route
 * is idempotent so nothing would actually be lost, but the screen would have told them their
 * progress was gone, and that is a lie the app told first.
 *
 * The diff exists because the battle response carries a LOG and no party
 * (`emberkin/src/server.ts:379-389`), while the battle route rewrites party, box and dexSeen
 * (`emberkin/src/battles.ts:184-191`). So "what changed" is the difference between two saves the
 * SERVER produced, never a number parsed out of prose.
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetch, installStorage, installWindow, json, removeStorage, removeWindow } from './browser-stubs.ts'
import { __resetAuth, setTokens } from '../src/lib/api.ts'
import { adopt, battleDelta, beginGame, loadSave, withCosmetics, type SaveMachine } from '../src/lib/save.ts'
import type { KinSave, SaveState } from '../src/lib/emberkin.ts'

let stub: ReturnType<typeof installFetch>

beforeEach(() => {
  installWindow('http://localhost:5195/')
  installStorage()
  __resetAuth()
  setTokens({ accessToken: 'a', refreshToken: 'r' })
})

afterEach(() => {
  stub?.restore()
  removeStorage()
  removeWindow()
})

function kin(overrides: Partial<KinSave> = {}): KinSave {
  return {
    speciesId: 'cindercub',
    nickname: null,
    level: 5,
    xp: 0,
    resonance: 0,
    temperament: 10,
    attunement: { hp: 12, attack: 8, defense: 8, spatk: 8, spdef: 8, speed: 8 },
    moves: ['ember_scratch'],
    heldItem: null,
    currentHp: 20,
    status: 'None',
    ...overrides,
  }
}

function save(overrides: Partial<SaveState> = {}): SaveState {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    wardenName: 'Ash',
    seed: '1',
    currentRegion: 'emberfall_vale',
    storyProgress: 0,
    playtimeSeconds: 0,
    party: [kin()],
    box: [],
    inventory: { potion: 3 },
    seals: [],
    dexSeen: ['cindercub'],
    equippedCosmetics: {},
    saveVersion: 1,
    ...overrides,
  }
}

describe('loadSave', () => {
  it('is `present` with the save when the service has one', async () => {
    stub = installFetch(() => json(200, save()))
    const machine = await loadSave()
    assert.equal(machine.status, 'present')
    assert.equal(machine.status === 'present' && machine.save.wardenName, 'Ash')
  })

  it('is `absent` on the 404 — a first-time player, not a failure', async () => {
    stub = installFetch(() => json(404, { error: { code: 'not_found', message: 'no save for this account' } }))
    assert.equal((await loadSave()).status, 'absent')
  })

  it('is `failed` on a 500, and carries the request id support needs', async () => {
    stub = installFetch(() => json(500, { error: { code: 'internal', message: 'boom', requestId: 'req-77' } }))
    const machine = await loadSave()
    assert.equal(machine.status, 'failed')
    assert.equal(machine.status === 'failed' && machine.notice.requestId, 'req-77')
  })

  it('is `failed`, NOT `absent`, when the service cannot be reached', async () => {
    // The distinction this whole file exists for.
    stub = installFetch(() => {
      throw new TypeError('fetch failed')
    })
    const machine = await loadSave()
    assert.equal(machine.status, 'failed')
    assert.notEqual(machine.status, 'absent')
  })

  it('is `failed` on a 403, and the notice says so', async () => {
    stub = installFetch(() => json(403, { error: { code: 'forbidden', message: 'missing authority' } }))
    const machine = await loadSave()
    assert.equal(machine.status, 'failed')
    assert.equal(machine.status === 'failed' && machine.notice.forbidden, true)
  })
})

describe('beginGame', () => {
  it('posts and becomes `present`', async () => {
    stub = installFetch(() => json(201, save({ wardenName: 'Rowan' })))
    const { machine } = await beginGame({ status: 'absent' }, { wardenName: 'Rowan', starter: 'cindercub' })
    assert.equal(machine.status, 'present')
    assert.equal(machine.status === 'present' && machine.save.wardenName, 'Rowan')
  })

  it('reports created:true only when the machine was ABSENT beforehand', async () => {
    stub = installFetch(() => json(201, save()))
    const fromAbsent = await beginGame({ status: 'absent' }, { wardenName: 'A', starter: 'cindercub' })
    assert.equal(fromAbsent.created, true)
  })

  it('reports created:false from a `present` machine — the route is idempotent', async () => {
    // `emberkin/src/server.ts:335` answers 200 with the existing save. Nothing is overwritten, and
    // "created" must not claim otherwise.
    stub = installFetch(() => json(200, save()))
    const prior: SaveMachine = { status: 'present', save: save() }
    const { created } = await beginGame(prior, { wardenName: 'A', starter: 'cindercub' })
    assert.equal(created, false)
  })

  it('sends the seed through when given', async () => {
    stub = installFetch(() => json(201, save()))
    await beginGame({ status: 'absent' }, { wardenName: 'A', starter: 'cindercub', seed: '42' })
    assert.equal(JSON.parse(stub.calls[0]!.body!)['seed'], '42')
  })

  it('omits the seed key when not given', async () => {
    stub = installFetch(() => json(201, save()))
    await beginGame({ status: 'absent' }, { wardenName: 'A', starter: 'cindercub' })
    assert.equal('seed' in JSON.parse(stub.calls[0]!.body!), false)
  })

  it('DOES NOT BLANK an existing save when the write fails', async () => {
    // A failed start from mid-game must leave the player looking at their party, not at an error
    // where their save used to be.
    stub = installFetch(() => json(503, { error: { code: 'unavailable', message: 'later' } }))
    const prior: SaveMachine = { status: 'present', save: save() }
    const { machine, created } = await beginGame(prior, { wardenName: 'A', starter: 'cindercub' })
    assert.equal(machine.status, 'present')
    assert.equal(created, false)
  })

  it('becomes `failed` when the write fails and there was nothing to keep', async () => {
    stub = installFetch(() => json(503, { error: { code: 'unavailable', message: 'later' } }))
    const { machine } = await beginGame({ status: 'absent' }, { wardenName: 'A', starter: 'cindercub' })
    assert.equal(machine.status, 'failed')
  })
})

describe('adopt and withCosmetics', () => {
  it('adopt wraps a server save as present', () => {
    const machine = adopt(save())
    assert.equal(machine.status, 'present')
  })

  it('withCosmetics replaces the whole map with the server’s', () => {
    const prior = adopt(save({ equippedCosmetics: { frame: 'old' } }))
    const next = withCosmetics(prior, { hud: 'new' })
    assert.deepEqual(next.status === 'present' ? next.save.equippedCosmetics : null, { hud: 'new' })
  })

  it('withCosmetics changes nothing else about the save', () => {
    const before = save({ party: [kin({ resonance: 40 })] })
    const next = withCosmetics(adopt(before), { frame: 'x' })
    assert.deepEqual(next.status === 'present' ? next.save.party : null, before.party)
    assert.equal(next.status === 'present' && next.save.wardenName, before.wardenName)
  })

  it('withCosmetics on a non-present machine returns it untouched, rather than inventing a save', () => {
    assert.deepEqual(withCosmetics({ status: 'absent' }, { frame: 'x' }), { status: 'absent' })
    assert.deepEqual(withCosmetics({ status: 'loading' }, { frame: 'x' }), { status: 'loading' })
  })
})

describe('battleDelta', () => {
  it('reports a Resonance change per slot', () => {
    const before = save({ party: [kin({ resonance: 20 })] })
    const after = save({ party: [kin({ resonance: 28 })] })
    const delta = battleDelta(before, after)
    assert.equal(delta.kin.length, 1)
    assert.equal(delta.kin[0]?.resonanceBefore, 20)
    assert.equal(delta.kin[0]?.resonanceAfter, 28)
  })

  it('reports level, temperament and hp alongside it', () => {
    const before = save({ party: [kin({ level: 5, temperament: 10, currentHp: 20 })] })
    const after = save({ party: [kin({ level: 6, temperament: 14, currentHp: 4 })] })
    const d = battleDelta(before, after).kin[0]
    assert.equal(d?.levelBefore, 5)
    assert.equal(d?.levelAfter, 6)
    assert.equal(d?.temperamentAfter, 14)
    assert.equal(d?.hpAfter, 4)
  })

  it('SKIPS a slot whose species changed — that is a different creature', () => {
    // A switch reordering the party, or an evolution. Reporting a Resonance "change" across two
    // different Kin would be a fabricated number.
    const before = save({ party: [kin({ speciesId: 'cindercub', resonance: 10 })] })
    const after = save({ party: [kin({ speciesId: 'cinderpyre', resonance: 90 })] })
    assert.deepEqual(battleDelta(before, after).kin, [])
  })

  it('skips a slot that did not exist before', () => {
    const before = save({ party: [kin()] })
    const after = save({ party: [kin(), kin({ speciesId: 'tidepup' })] })
    assert.equal(battleDelta(before, after).kin.length, 1)
  })

  it('reports newly seen species', () => {
    const before = save({ dexSeen: ['cindercub'] })
    const after = save({ dexSeen: ['cindercub', 'coalcrawl'] })
    assert.deepEqual(battleDelta(before, after).newlySeen, ['coalcrawl'])
  })

  it('reports nothing newly seen when the dex did not grow', () => {
    assert.deepEqual(battleDelta(save(), save()).newlySeen, [])
  })

  it('reports a catch as the tail of an append-only box', () => {
    const before = save({ box: [] })
    const after = save({ box: [kin({ speciesId: 'coalcrawl' })] })
    assert.deepEqual(battleDelta(before, after).caught, ['coalcrawl'])
  })

  it('reports a SECOND identical catch — the case value-matching would have lost', () => {
    const one = kin({ speciesId: 'coalcrawl' })
    const before = save({ box: [one] })
    const after = save({ box: [one, one] })
    assert.deepEqual(battleDelta(before, after).caught, ['coalcrawl'])
  })

  it('reports no catch when the box is unchanged', () => {
    const before = save({ box: [kin({ speciesId: 'coalcrawl' })] })
    assert.deepEqual(battleDelta(before, before).caught, [])
  })

  it('reports nothing at all when nothing changed', () => {
    const s = save()
    const d = battleDelta(s, s)
    assert.equal(d.newlySeen.length, 0)
    assert.equal(d.caught.length, 0)
    assert.equal(d.kin[0]?.resonanceBefore, d.kin[0]?.resonanceAfter)
  })
})
