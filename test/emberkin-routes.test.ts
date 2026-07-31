/**
 * THE REQUEST, ASSERTED. Every call this client makes to `micro-emberkin`.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE IS THE MOST IMPORTANT ONE IN THE SUITE.
 *
 * Two clients in this estate shipped calling routes that did not exist:
 *
 *   `micro-wallet`  called `/v1/quotes`; pricing serves `/rates`.
 *   `micro-market`  called `/v1/decisions/market.listing`; `micro-policy` has no `/v1` routes at
 *                   all, and because policy reads a 404 as `peerDecided`, that returned **403 on
 *                   every listing** and closed the marketplace.
 *
 * Both had tests. Both sets of tests stubbed `fetch` and asserted the RESPONSE — which the test
 * itself had written — so the path was never looked at by anything. Every test below asserts the
 * request instead: the URL, the method, the headers and the body, byte for byte, against the route
 * table in `emberkin/src/server.ts`. The service is not running; the point is that it does not
 * need to be, because what these tests check is the half of the conversation this repository owns.
 *
 * A route string here is a claim about a specific line of another repository. The claims:
 *
 *   POST /v1/saves                  server.ts:322
 *   GET  /v1/saves/me               server.ts:338
 *   POST /v1/saves/me/battles       server.ts:345
 *   PUT  /v1/saves/me/cosmetics     server.ts:392
 *   GET  /v1/saves/me/achievements  server.ts:409
 *   GET  /v1/content/dex            server.ts:431
 *   GET  /readyz                    server.ts:240
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, describe, it } from 'node:test'
import { installFetch, installStorage, installWindow, json, removeStorage, removeWindow, type FetchCall } from './browser-stubs.ts'
import { __resetAuth, setTokens } from '../src/lib/api.ts'
import {
  equipCosmetic,
  fetchAchievements,
  fetchDex,
  fetchReadiness,
  fetchSave,
  newIdempotencyKey,
  startGame,
  submitBattle,
} from '../src/lib/emberkin.ts'
import { ApiError } from '../src/lib/api.ts'

/** The dev-port base every call must land on. `emberkin/src/env.ts:121` — PORT default 4100. */
const BASE = 'http://localhost:4100'

let stub: ReturnType<typeof installFetch>

function lastCall(): FetchCall {
  const call = stub.calls[stub.calls.length - 1]
  assert.ok(call, 'no request was made — a test that asserts nothing is not a test')
  return call
}

function bodyOf(call: FetchCall): Record<string, unknown> {
  assert.ok(call.body, `${call.method} ${call.url} was sent with no body`)
  return JSON.parse(call.body) as Record<string, unknown>
}

beforeEach(() => {
  installWindow('http://localhost:5195/')
  installStorage()
  __resetAuth()
  setTokens({ accessToken: 'access-token', refreshToken: 'refresh-token' })
})

afterEach(() => {
  stub?.restore()
  removeStorage()
  removeWindow()
})

after(() => {
  __resetAuth()
})

/* ==================================================================== the base */

describe('every request goes to micro-emberkin', () => {
  it('addresses the service, not the page origin', async () => {
    stub = installFetch(() => json(200, { dex: [] }))
    await fetchDex()
    // The page is on 5195 and the service on 4100. A relative URL would have hit the static file
    // server, which is what the template's own `apiBase()` would have produced — see hosts.ts.
    assert.equal(lastCall().url, `${BASE}/v1/content/dex`)
    assert.notEqual(new URL(lastCall().url).port, '5195')
  })

  it('carries the bearer token on an authenticated route', async () => {
    stub = installFetch(() => json(200, saveBody()))
    await fetchSave()
    assert.equal(lastCall().headers['authorization'], 'Bearer access-token')
  })

  it('does NOT carry a token on the public dex route', async () => {
    // `emberkin/src/server.ts:431` takes no principal — the handler destructures `_ctx`. Sending
    // a token to a public route is not a failure, but it is a needless credential on the wire.
    stub = installFetch(() => json(200, { dex: [] }))
    await fetchDex()
    assert.equal(lastCall().headers['authorization'], undefined)
  })
})

/* ==================================================================== POST /v1/saves */

describe('startGame — POST /v1/saves (server.ts:322)', () => {
  it('posts to exactly /v1/saves', async () => {
    stub = installFetch(() => json(201, saveBody()))
    await startGame({ wardenName: 'Ash', starter: 'cindercub' })
    assert.equal(lastCall().url, `${BASE}/v1/saves`)
    assert.equal(lastCall().method, 'POST')
  })

  it('sends wardenName and starter, the two fields requireString demands', async () => {
    stub = installFetch(() => json(201, saveBody()))
    await startGame({ wardenName: 'Ash', starter: 'cindercub' })
    // `server.ts:325-326` — requireString(body, 'wardenName') and requireString(body, 'starter').
    assert.deepEqual(bodyOf(lastCall()), { wardenName: 'Ash', starter: 'cindercub' })
  })

  it('omits seed entirely when it is not given', async () => {
    stub = installFetch(() => json(201, saveBody()))
    await startGame({ wardenName: 'Ash', starter: 'cindercub' })
    assert.equal('seed' in bodyOf(lastCall()), false)
  })

  it('sends seed as a STRING, because readOptionalSeed rejects a number', async () => {
    stub = installFetch(() => json(201, saveBody()))
    await startGame({ wardenName: 'Ash', starter: 'cindercub', seed: '12345678901234567890' })
    const body = bodyOf(lastCall())
    // `server.ts:465-473`: a seed must match /^\d{1,20}$/ AS A STRING. A JSON number would be a
    // 400 here, and worse, would silently lose precision above 2^53 before it ever left.
    assert.equal(typeof body['seed'], 'string')
    assert.equal(body['seed'], '12345678901234567890')
  })

  it('sets content-type on a body-carrying request', async () => {
    stub = installFetch(() => json(201, saveBody()))
    await startGame({ wardenName: 'Ash', starter: 'cindercub' })
    assert.equal(lastCall().headers['content-type'], 'application/json')
  })

  it('returns the save the service sent, unmodified', async () => {
    const wire = saveBody({ wardenName: 'Rowan' })
    stub = installFetch(() => json(201, wire))
    const save = await startGame({ wardenName: 'Rowan', starter: 'tidepup' })
    assert.equal(save.wardenName, 'Rowan')
    assert.equal(save.seed, wire.seed)
  })
})

/* ==================================================================== GET /v1/saves/me */

describe('fetchSave — GET /v1/saves/me (server.ts:338)', () => {
  it('gets exactly /v1/saves/me', async () => {
    stub = installFetch(() => json(200, saveBody()))
    await fetchSave()
    assert.equal(lastCall().url, `${BASE}/v1/saves/me`)
    assert.equal(lastCall().method, 'GET')
  })

  it('sends no body on a GET', async () => {
    stub = installFetch(() => json(200, saveBody()))
    await fetchSave()
    assert.equal(lastCall().body, undefined)
  })

  it('maps the 404 at server.ts:341 to null, not to an error', async () => {
    // "no save for this account" is what a first-time player gets. Treating it as a failure would
    // show them an error instead of a title screen.
    stub = installFetch(() => json(404, { error: { code: 'not_found', message: 'no save for this account' } }))
    assert.equal(await fetchSave(), null)
  })

  it('still throws on a 500 — only the 404 is expected', async () => {
    stub = installFetch(() => json(500, { error: { code: 'internal', message: 'nope' } }))
    await assert.rejects(() => fetchSave(), (err: unknown) => err instanceof ApiError && err.status === 500)
  })

  it('keeps seed a string, because it is a ulong (server.ts:521)', async () => {
    stub = installFetch(() => json(200, saveBody({ seed: '18446744073709551615' })))
    const save = await fetchSave()
    assert.equal(save?.seed, '18446744073709551615')
    // The point of the string: this value is not representable as a JSON number.
    assert.notEqual(String(Number('18446744073709551615')), '18446744073709551615')
  })
})

/* ==================================================================== POST battles */

describe('submitBattle — POST /v1/saves/me/battles (server.ts:345)', () => {
  const enemy = { name: 'Wild', isWild: true, party: [{ species: 'coalcrawl', level: 4 }] }

  it('posts to exactly /v1/saves/me/battles', async () => {
    stub = installFetch(() => json(200, battleBody()))
    await submitBattle('key-1', { enemy })
    assert.equal(lastCall().url, `${BASE}/v1/saves/me/battles`)
    assert.equal(lastCall().method, 'POST')
  })

  it('SENDS THE IDEMPOTENCY-KEY HEADER — server.ts:347-350 is a 400 without it', async () => {
    stub = installFetch(() => json(200, battleBody()))
    await submitBattle('key-abc', { enemy })
    assert.equal(lastCall().headers['idempotency-key'], 'key-abc')
  })

  it('re-sends the key on the retry after a token refresh', async () => {
    // The header is built inside `send()`, so the second attempt carries it too. A refreshed retry
    // that dropped the key would resolve — and APPLY TO THE SAVE — a second battle, which is
    // exactly what the key exists to prevent.
    let first = true
    stub = installFetch((call) => {
      if (call.url.endsWith('/auth/refresh')) {
        return json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' })
      }
      if (first) {
        first = false
        return json(401, { error: { code: 'unauthenticated', message: 'expired' } })
      }
      return json(200, battleBody())
    })
    await submitBattle('key-retry', { enemy })
    const battleCalls = stub.calls.filter((c) => c.url.endsWith('/v1/saves/me/battles'))
    assert.equal(battleCalls.length, 2)
    for (const call of battleCalls) assert.equal(call.headers['idempotency-key'], 'key-retry')
  })

  it('sends the enemy exactly as parseEnemy reads it', async () => {
    stub = installFetch(() => json(200, battleBody()))
    await submitBattle('k', { enemy })
    const body = bodyOf(lastCall())
    // `server.ts:475-496`: name (string), isWild (=== true), party (non-empty array of
    // {species: string, level: number}).
    assert.deepEqual(body['enemy'], enemy)
  })

  it('sends isWild as a real boolean — server.ts:479 tests `=== true`', async () => {
    stub = installFetch(() => json(200, battleBody()))
    await submitBattle('k', { enemy })
    const sent = (bodyOf(lastCall())['enemy'] as { isWild: unknown }).isWild
    assert.strictEqual(sent, true)
    // A truthy string would be read as false, and a wild encounter would silently become a
    // trainer battle in which the catch action does nothing.
    assert.notStrictEqual(sent, 'true')
  })

  it('omits script when there is none, rather than sending null', async () => {
    stub = installFetch(() => json(200, battleBody()))
    await submitBattle('k', { enemy })
    assert.equal('script' in bodyOf(lastCall()), false)
  })

  it('sends the script array when there is one', async () => {
    stub = installFetch(() => json(200, battleBody()))
    await submitBattle('k', { enemy, script: [{ kind: 'move', move: 'ember_scratch' }, { kind: 'flee' }] })
    assert.deepEqual(bodyOf(lastCall())['script'], [
      { kind: 'move', move: 'ember_scratch' },
      { kind: 'flee' },
    ])
  })

  it('sends maxTurns as a number — server.ts:355 tests typeof === number', async () => {
    stub = installFetch(() => json(200, battleBody()))
    await submitBattle('k', { enemy, maxTurns: 24 })
    assert.strictEqual(bodyOf(lastCall())['maxTurns'], 24)
  })

  it('sends seed as a string here too', async () => {
    stub = installFetch(() => json(200, battleBody()))
    await submitBattle('k', { enemy, seed: '99' })
    assert.strictEqual(bodyOf(lastCall())['seed'], '99')
  })

  it('surfaces `replayed`, so the UI can say a battle was already recorded', async () => {
    stub = installFetch(() => json(200, battleBody({ replayed: true })))
    const result = await submitBattle('k', { enemy })
    assert.equal(result.replayed, true)
  })

  it('carries unlocked achievements through unchanged', async () => {
    stub = installFetch(() =>
      json(200, battleBody({ unlocked: [{ code: 'resonance_attuned', name: 'Attuned', points: 10 }] })),
    )
    const result = await submitBattle('k', { enemy })
    assert.deepEqual(result.unlocked, [{ code: 'resonance_attuned', name: 'Attuned', points: 10 }])
  })
})

describe('newIdempotencyKey', () => {
  it('is different every time — the key is per submission, not per body', () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()))
    assert.equal(keys.size, 200)
  })

  it('fits the 1..200 character bound server.ts:348 enforces', () => {
    const key = newIdempotencyKey()
    assert.ok(key.length >= 1 && key.length <= 200, `key length ${key.length} is out of range`)
  })
})

/* ==================================================================== PUT cosmetics */

describe('equipCosmetic — PUT /v1/saves/me/cosmetics (server.ts:392)', () => {
  it('PUTs to exactly /v1/saves/me/cosmetics', async () => {
    stub = installFetch(() => json(200, { equippedCosmetics: {} }))
    await equipCosmetic('frame', 'ember_frame')
    assert.equal(lastCall().url, `${BASE}/v1/saves/me/cosmetics`)
    assert.equal(lastCall().method, 'PUT')
  })

  it('sends {slot, itemUrn}', async () => {
    stub = installFetch(() => json(200, { equippedCosmetics: { frame: 'ember_frame' } }))
    await equipCosmetic('frame', 'ember_frame')
    assert.deepEqual(bodyOf(lastCall()), { slot: 'frame', itemUrn: 'ember_frame' })
  })

  it('SENDS null EXPLICITLY to clear a slot — undefined is a 400 at server.ts:396-397', async () => {
    stub = installFetch(() => json(200, { equippedCosmetics: {} }))
    await equipCosmetic('frame', null)
    const body = bodyOf(lastCall())
    assert.equal('itemUrn' in body, true, 'itemUrn must be PRESENT and null, never omitted')
    assert.strictEqual(body['itemUrn'], null)
  })

  it('returns the map the server sent, which is the new truth for that field', async () => {
    stub = installFetch(() => json(200, { equippedCosmetics: { frame: 'a', hud: 'b' } }))
    const answer = await equipCosmetic('hud', 'b')
    assert.deepEqual(answer.equippedCosmetics, { frame: 'a', hud: 'b' })
  })

  it('surfaces the 403 cosmetic_not_owned with its code (server.ts:210-212)', async () => {
    stub = installFetch(() =>
      json(403, { error: { code: 'cosmetic_not_owned', message: "account does not own cosmetic 'x'", requestId: 'r-9' } }),
    )
    await assert.rejects(
      () => equipCosmetic('frame', 'x'),
      (err: unknown) =>
        err instanceof ApiError && err.status === 403 && err.code === 'cosmetic_not_owned' && err.requestId === 'r-9',
    )
  })

  it('surfaces the 503 entitlements_unavailable — the write FAILS CLOSED (server.ts:221-223)', async () => {
    stub = installFetch(() => json(503, { error: { code: 'entitlements_unavailable', message: 'try again' } }))
    await assert.rejects(
      () => equipCosmetic('frame', 'x'),
      (err: unknown) => err instanceof ApiError && err.status === 503 && err.code === 'entitlements_unavailable',
    )
  })
})

/* ==================================================================== achievements + dex */

describe('fetchAchievements — GET /v1/saves/me/achievements (server.ts:409)', () => {
  it('gets exactly that path', async () => {
    stub = installFetch(() => json(200, { achievements: [] }))
    await fetchAchievements()
    assert.equal(lastCall().url, `${BASE}/v1/saves/me/achievements`)
  })

  it('unwraps the `achievements` key the handler wraps them in (server.ts:417)', async () => {
    const rows = [{ code: 'a', name: 'A', points: 1, unlockedAt: '2026-01-01T00:00:00.000Z', delivered: false }]
    stub = installFetch(() => json(200, { achievements: rows }))
    assert.deepEqual(await fetchAchievements(), rows)
  })

  it('does not re-sort — the order is the server’s `order by unlocked_at desc`', async () => {
    const rows = [
      { code: 'z', name: 'Z', points: 1, unlockedAt: '2026-02-01T00:00:00.000Z', delivered: true },
      { code: 'a', name: 'A', points: 1, unlockedAt: '2026-01-01T00:00:00.000Z', delivered: false },
    ]
    stub = installFetch(() => json(200, { achievements: rows }))
    const got = await fetchAchievements()
    assert.equal(got[0]?.code, 'z')
  })
})

describe('fetchDex — GET /v1/content/dex (server.ts:431)', () => {
  it('gets exactly /v1/content/dex', async () => {
    stub = installFetch(() => json(200, { dex: [] }))
    await fetchDex()
    assert.equal(lastCall().url, `${BASE}/v1/content/dex`)
  })

  it('unwraps the `dex` key (server.ts:433)', async () => {
    const dex = [{ id: 'cindercub', dexNumber: 1, name: 'Cindercub', types: ['ember'] }]
    stub = installFetch(() => json(200, { dex }))
    assert.deepEqual(await fetchDex(), dex)
  })

  it('tolerates a missing dex key rather than throwing on `.map` later', async () => {
    stub = installFetch(() => json(200, {}))
    assert.deepEqual(await fetchDex(), [])
  })
})

/* ==================================================================== readyz */

describe('fetchReadiness — GET /readyz (server.ts:240)', () => {
  it('gets /readyz, unauthenticated', async () => {
    stub = installFetch(() => json(200, { ready: true }))
    await fetchReadiness()
    assert.equal(lastCall().url, `${BASE}/readyz`)
    assert.equal(lastCall().headers['authorization'], undefined)
  })

  it('reads ready:true', async () => {
    stub = installFetch(() => json(200, { ready: true }))
    assert.deepEqual(await fetchReadiness(), { ready: true })
  })

  it('reads the 503 body as not-ready rather than throwing (server.ts:242)', async () => {
    stub = installFetch(() => json(503, { ready: false, checks: [] }))
    assert.deepEqual(await fetchReadiness(), { ready: false })
  })

  it('reports not-ready when the service cannot be reached at all', async () => {
    stub = installFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    assert.deepEqual(await fetchReadiness(), { ready: false })
  })
})

/* ==================================================================== the negative test */

describe('the routes this client must NOT call', () => {
  /**
   * The guard against the wallet/market defect, stated positively.
   *
   * Every path the client sends is collected and checked against the ten routes
   * `emberkin/src/server.ts` compiles. A path that is not one of them is the exact bug that closed
   * the marketplace, and this is where it fails.
   */
  const KNOWN: readonly string[] = [
    '/livez',
    '/readyz',
    '/metrics',
    '/v1/events',
    '/v1/saves',
    '/v1/saves/me',
    '/v1/saves/me/battles',
    '/v1/saves/me/cosmetics',
    '/v1/saves/me/achievements',
    '/v1/content/dex',
  ]

  it('exercises every client call and every path is in the service’s route table', async () => {
    stub = installFetch((call) => {
      if (call.url.includes('/v1/saves/me/achievements')) return json(200, { achievements: [] })
      if (call.url.includes('/v1/content/dex')) return json(200, { dex: [] })
      if (call.url.includes('/v1/saves/me/battles')) return json(200, battleBody())
      if (call.url.includes('/v1/saves/me/cosmetics')) return json(200, { equippedCosmetics: {} })
      if (call.url.includes('/readyz')) return json(200, { ready: true })
      return json(200, saveBody())
    })

    await startGame({ wardenName: 'A', starter: 'cindercub' })
    await fetchSave()
    await submitBattle('k', { enemy: { name: 'Wild', isWild: true, party: [{ species: 'x', level: 1 }] } })
    await equipCosmetic('frame', null)
    await fetchAchievements()
    await fetchDex()
    await fetchReadiness()

    assert.equal(stub.calls.length, 7, 'every client call must be exercised by this test')
    for (const call of stub.calls) {
      const path = new URL(call.url).pathname
      assert.ok(KNOWN.includes(path), `${path} is not a route emberkin/src/server.ts defines`)
    }
  })

  it('never calls a /v1 path that does not begin /v1/saves or /v1/content', async () => {
    // The market defect in one line: a plausible-looking `/v1/<noun>` that the other side does not
    // serve. There are exactly two `/v1` prefixes in emberkin's table, plus the webhook.
    stub = installFetch(() => json(200, { dex: [] }))
    await fetchDex()
    const path = new URL(lastCall().url).pathname
    assert.ok(path.startsWith('/v1/saves') || path.startsWith('/v1/content') || !path.startsWith('/v1'))
  })
})

/* ==================================================================== fixtures */

function saveBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    wardenName: 'Ash',
    seed: '12345',
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
    ...overrides,
  }
}

function battleBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    battleId: '22222222-2222-4222-8222-222222222222',
    outcome: 'Victory',
    turns: 3,
    replayed: false,
    log: ['Go, Cindercub!'],
    unlocked: [],
    ...overrides,
  }
}
