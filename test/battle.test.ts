/**
 * Building the intent, and reading the log back.
 *
 * `toScriptAction` is the one place a client mistake becomes a DIFFERENT BATTLE rather than an
 * error: `parseScript` at `emberkin/src/server.ts:498-515` picks up `slot`, `move`, `item` and
 * `index` when they are the right primitive type and SILENTLY DROPS anything else. A field spelled
 * wrong here does not fail loudly; it resolves a battle nobody asked for. So every intent's emitted
 * object is asserted key by key.
 *
 * `cueFor` is the second half: its phrases were read out of `emberkin/src/engine/battle.ts` and its
 * first draft matched two strings the engine never writes. The tests below quote the engine's own
 * lines, so a phrase that does not exist cannot pass.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  beatsFrom,
  cueFor,
  currentRegion,
  outcomeLabel,
  rollEncounter,
  SCRIPT_KINDS,
  toScript,
  toScriptAction,
  wildEnemy,
  type Intent,
} from '../src/lib/battle.ts'
import type { Region } from '../src/lib/content.ts'

describe('toScriptAction — against parseScript (server.ts:498-515)', () => {
  it('emits only kinds the server enumerates at server.ts:504', () => {
    const intents: Intent[] = [
      { kind: 'move', moveId: 'ember_scratch' },
      { kind: 'art' },
      { kind: 'catch', itemId: 'resonator' },
      { kind: 'flee' },
      { kind: 'switch', index: 2 },
      { kind: 'item', itemId: 'potion' },
    ]
    for (const intent of intents) {
      assert.ok(SCRIPT_KINDS.includes(toScriptAction(intent).kind), `${intent.kind} is not an accepted kind`)
    }
  })

  it('covers all six kinds — the test above cannot pass by testing five', () => {
    assert.equal(SCRIPT_KINDS.length, 6)
  })

  it('sends a move as {kind:"move", move:<id>} — the key is `move`, not `moveId`', () => {
    // `server.ts:510` reads `s['move']`. `moveId` would be dropped in silence and the server would
    // fall back to `active.moves[slot ?? 0]` — a different attack, every turn, with no error.
    assert.deepEqual(toScriptAction({ kind: 'move', moveId: 'flame_fang' }), {
      kind: 'move',
      move: 'flame_fang',
    })
  })

  it('sends an art with NO move id', () => {
    // `emberkin/src/battles.ts:74-75` maps `art` to the species' own `resonanceArt`. Naming a move
    // here would be offering the player a choice the server does not have.
    assert.deepEqual(toScriptAction({ kind: 'art' }), { kind: 'art' })
  })

  it('sends a catch as {kind:"catch", item:<id>} — the key is `item`, not `itemId`', () => {
    // `server.ts:511` reads `s['item']`; `battles.ts:78` defaults to 'resonator' when it is absent,
    // so a wrong key would silently downgrade a Master Resonator to a basic one.
    assert.deepEqual(toScriptAction({ kind: 'catch', itemId: 'master_resonator' }), {
      kind: 'catch',
      item: 'master_resonator',
    })
  })

  it('sends a flee with nothing else', () => {
    assert.deepEqual(toScriptAction({ kind: 'flee' }), { kind: 'flee' })
  })

  it('sends a switch as {kind:"switch", index:<n>} — a NUMBER', () => {
    // `server.ts:512` tests `typeof s['index'] === 'number'`; `battles.ts:82` defaults to -1, which
    // is not a slot. A string index would silently become "switch to nothing".
    const action = toScriptAction({ kind: 'switch', index: 2 })
    assert.deepEqual(action, { kind: 'switch', index: 2 })
    assert.strictEqual(action.index, 2)
  })

  it('sends index 0 rather than omitting it — 0 is a real slot', () => {
    assert.strictEqual(toScriptAction({ kind: 'switch', index: 0 }).index, 0)
  })

  it('sends an item as {kind:"item", item:<id>}', () => {
    assert.deepEqual(toScriptAction({ kind: 'item', itemId: 'potion' }), { kind: 'item', item: 'potion' })
  })

  it('never emits a key parseScript does not read', () => {
    const READ = new Set(['kind', 'slot', 'move', 'item', 'index'])
    const intents: Intent[] = [
      { kind: 'move', moveId: 'a' },
      { kind: 'art' },
      { kind: 'catch', itemId: 'b' },
      { kind: 'flee' },
      { kind: 'switch', index: 1 },
      { kind: 'item', itemId: 'c' },
    ]
    for (const action of toScript(intents)) {
      for (const key of Object.keys(action)) {
        assert.ok(READ.has(key), `${key} is emitted and parseScript would drop it`)
      }
    }
  })

  it('maps a list in order', () => {
    const script = toScript([
      { kind: 'move', moveId: 'a' },
      { kind: 'flee' },
    ])
    assert.equal(script.length, 2)
    assert.equal(script[0]?.move, 'a')
    assert.equal(script[1]?.kind, 'flee')
  })

  it('maps an empty list to an empty script, which the server reads as "first move each turn"', () => {
    assert.deepEqual(toScript([]), [])
  })
})

describe('wildEnemy', () => {
  it('sets isWild true, which is what makes a catch possible at all', () => {
    // `emberkin/src/battles.ts:135` passes it to BattleSide; only a wild side can be caught.
    const enemy = wildEnemy({ species: 'coalcrawl', level: 5 })
    assert.strictEqual(enemy.isWild, true)
  })

  it('sends a non-empty party — server.ts:481 rejects an empty one with a 400', () => {
    assert.equal(wildEnemy({ species: 'coalcrawl', level: 5 }).party.length, 1)
  })

  it('names the side, so the log says something', () => {
    assert.equal(wildEnemy({ species: 'coalcrawl', level: 5 }).name, 'Wild')
  })
})

describe('rollEncounter', () => {
  const region: Region = {
    id: 'r',
    name: 'R',
    act: 1,
    wildKin: [
      { species: 'a', levels: [3, 6], weight: 20 },
      { species: 'b', levels: [4, 4], weight: 30 },
      { species: 'c', levels: [1, 2], weight: 50 },
    ],
    nodes: [],
  }

  it('picks the first entry at the bottom of the range', () => {
    assert.equal(rollEncounter(region, () => 0)?.species, 'a')
  })

  it('picks the second entry just inside its band', () => {
    // Total weight 100. a is [0,20), b is [20,50), c is [50,100).
    assert.equal(rollEncounter(region, () => 0.25)?.species, 'b')
  })

  it('picks the third entry in its band', () => {
    assert.equal(rollEncounter(region, () => 0.75)?.species, 'c')
  })

  it('picks the LAST entry at the very top, rather than dropping the encounter', () => {
    // Floating point can leave the accumulator a hair above zero after the last subtraction.
    // Returning null there would drop an encounter roughly once in 2^50, which is the sort of bug
    // that gets reported once a year and never reproduced.
    assert.equal(rollEncounter(region, () => 0.999999999)?.species, 'c')
  })

  it('picks a level inside the stated range, at both ends', () => {
    assert.equal(rollEncounter(region, () => 0)?.level, 3)
    // `random()` is called twice — once for the species, once for the level.
    const values = [0, 0.999]
    let i = 0
    assert.equal(rollEncounter(region, () => values[i++] ?? 0)?.level, 6)
  })

  it('handles a single-level range', () => {
    const single: Region = { ...region, wildKin: [{ species: 'b', levels: [4, 4], weight: 1 }] }
    assert.equal(rollEncounter(single, () => 0.5)?.level, 4)
  })

  it('is null for a region with no encounter table', () => {
    assert.equal(rollEncounter({ ...region, wildKin: [] }), null)
  })

  it('is null when every weight is zero, rather than dividing by it', () => {
    const zeroed: Region = { ...region, wildKin: [{ species: 'a', levels: [1, 1], weight: 0 }] }
    assert.equal(rollEncounter(zeroed, () => 0.5), null)
  })
})

describe('cueFor — phrases read out of emberkin/src/engine/battle.ts', () => {
  const cases: readonly [string, string, string][] = [
    ['A critical hit!', 'critical', 'battle.ts:283'],
    ['Gotcha! Coalcrawl resonates with you now.', 'catch', 'battle.ts:236'],
    ['Coalcrawl fainted!', 'faint', 'battle.ts:403'],
    ["It's super effective!", 'effective', 'typechart.ts:37'],
    ["It's not very effective...", 'effective', 'typechart.ts:36'],
    ['It has no effect...', 'no-effect', 'typechart.ts:35'],
    ["It doesn't affect Coalcrawl...", 'no-effect', 'battle.ts:278'],
    ["Cindercub's attack missed!", 'miss', 'battle.ts:267'],
    ['✦ Cindercub channels its Resonance Art — Cinder Nova!', 'art', 'battle.ts:260'],
    ['Cindercub used Ember Scratch!', 'attack', 'battle.ts:262'],
  ]

  it('reads every one of the engine’s own lines', () => {
    for (const [line, kind, cite] of cases) {
      assert.equal(cueFor(line)?.kind, kind, `${cite}: ${line}`)
    }
    assert.equal(cases.length, 10, 'the table shrank; a log line has stopped being covered')
  })

  it('distinguishes super effective from not very effective', () => {
    assert.deepEqual(cueFor("It's super effective!"), { kind: 'effective', more: true })
    assert.deepEqual(cueFor("It's not very effective..."), { kind: 'effective', more: false })
  })

  it('does NOT read an item use as an attack, though both contain "used "', () => {
    // `battle.ts:201` — "<side> used Potion. <name> recovered 40 HP." The attack test requires the
    // line to END in `!`, which move lines do and item lines do not.
    assert.equal(cueFor('Ash used Potion. Cindercub recovered 40 HP.'), null)
    assert.equal(cueFor("Ash used Salve. Cindercub's Burn was cured."), null)
  })

  it('reads the Art before it reads a plain attack — the Art line also ends in "!"', () => {
    assert.equal(cueFor('✦ Cindercub channels its Resonance Art — Cinder Nova!')?.kind, 'art')
  })

  it('returns null for a line it does not recognise, rather than guessing', () => {
    // A neutral beat plays and the text is still shown. Guessing would put a faint animation on a
    // line about the weather.
    assert.equal(cueFor('Go, Cindercub!'), null)
    assert.equal(cueFor('Cindercub took 12 damage. (30/42 HP)'), null)
    assert.equal(cueFor(''), null)
  })

  it('is case-insensitive', () => {
    assert.equal(cueFor('A CRITICAL HIT!')?.kind, 'critical')
  })

  it('never matches a phrase the engine does not write', () => {
    // The first draft of `cueFor` matched 'was caught' and 'unleashes'. Neither appears anywhere
    // in the engine, so the catch would have animated nothing and the Art would have animated as
    // an ordinary attack.
    assert.equal(cueFor('Coalcrawl was caught'), null)
    assert.equal(cueFor('Cindercub unleashes something'), null)
  })
})

describe('beatsFrom', () => {
  it('keeps EVERY line, in order, whether or not it was understood', () => {
    // A parser that dropped what it could not classify would hide exactly the turn that went wrong.
    const log = ['Go, Cindercub!', 'Cindercub used Ember Scratch!', 'something new the engine writes']
    const beats = beatsFrom(log)
    assert.equal(beats.length, 3)
    assert.deepEqual(beats.map((b) => b.text), log)
  })

  it('marks the unrecognised ones with a null cue rather than omitting them', () => {
    const beats = beatsFrom(['Go, Cindercub!'])
    assert.equal(beats[0]?.cue, null)
    assert.equal(beats[0]?.text, 'Go, Cindercub!')
  })

  it('handles an empty log', () => {
    assert.deepEqual(beatsFrom([]), [])
  })
})

describe('outcomeLabel', () => {
  it('names each of the engine’s five outcomes', () => {
    assert.equal(outcomeLabel('Victory'), 'Victory')
    assert.equal(outcomeLabel('Defeat'), 'Defeated')
    assert.equal(outcomeLabel('Caught'), 'Caught')
    assert.equal(outcomeLabel('Fled'), 'Got away')
    assert.match(outcomeLabel('Ongoing'), /turn limit/)
  })

  it('ECHOES an outcome it does not know, rather than mapping it to a loss', () => {
    // A new outcome string appearing on screen unchanged is a bug report; one silently rendered as
    // "Defeated" is not.
    assert.equal(outcomeLabel('Surrendered'), 'Surrendered')
  })
})

describe('currentRegion', () => {
  const content = {
    campaign: { regions: [{ id: 'emberfall_vale', name: 'Emberfall Vale', act: 1, wildKin: [], nodes: [] }] },
  } as unknown as Parameters<typeof currentRegion>[0]

  it('finds a region the campaign declares', () => {
    assert.equal(currentRegion(content, 'emberfall_vale')?.name, 'Emberfall Vale')
  })

  it('is null for a region this build does not know', () => {
    assert.equal(currentRegion(content, 'somewhere_new'), null)
  })
})
