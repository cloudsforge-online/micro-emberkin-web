/**
 * Billing: the request, and the ownership rule in both directions.
 *
 * The ownership rule is duplicated between this client and `emberkin/src/billingclient.ts`,
 * and a duplicated rule that drifts is worse than no rule: the wardrobe would offer an item the
 * service then refused, or hide one it would have allowed. So every branch of it is driven here,
 * both ways — a gate that only ever answers "yes" in its tests is not a gate.
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetch, installStorage, installWindow, json, removeStorage, removeWindow } from './browser-stubs.ts'
import { __resetAuth, setTokens } from '../src/lib/api.ts'
import { fetchEntitlements, matchesTitle, owns, skuOf, TITLE_SCOPE, type Entitlement } from '../src/lib/billing.ts'

/** `ui/packages/ui/src/surfaces.ts` — `pay` is billing, dev port 4003. */
const BILLING = 'http://localhost:4003'

let stub: ReturnType<typeof installFetch>

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

function ent(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    id: 'e1',
    sku: 'ember_frame',
    scope: `title:${TITLE_SCOPE}`,
    source: 'purchase',
    grantedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    active: true,
    metadata: {},
    ...overrides,
  }
}

describe('fetchEntitlements — GET /entitlements (billing/src/server.ts)', () => {
  it('addresses BILLING, not emberkin', async () => {
    // emberkin has no entitlement route a browser may call: its own client uses
    // `/internal/entitlements/:userId`, which refuses a user token outright
    // (`billing/src/server.ts`).
    stub = installFetch(() => json(200, { at: '2026-01-01T00:00:00.000Z', entitlements: [] }))
    await fetchEntitlements()
    assert.equal(stub.calls[0]?.url, `${BILLING}/entitlements`)
    assert.notEqual(new URL(stub.calls[0]!.url).port, '4100')
  })

  it('never calls the internal route', async () => {
    stub = installFetch(() => json(200, { entitlements: [] }))
    await fetchEntitlements()
    assert.ok(!stub.calls[0]!.url.includes('/internal/'))
  })

  it('sends no userId — billing defaults the subject to the caller (server.ts)', async () => {
    stub = installFetch(() => json(200, { entitlements: [] }))
    await fetchEntitlements()
    assert.equal(new URL(stub.calls[0]!.url).searchParams.get('userId'), null)
  })

  it('sends NO scope filter, matching emberkin/src/billingclient.ts', async () => {
    // "Asked WITHOUT the scope filter and matched here, so a cross-title (`platform`-scoped)
    // cosmetic is found." A `?scope=` here would hide platform cosmetics the service would equip.
    stub = installFetch(() => json(200, { entitlements: [] }))
    await fetchEntitlements()
    assert.equal(new URL(stub.calls[0]!.url).searchParams.get('scope'), null)
    assert.equal(new URL(stub.calls[0]!.url).search, '')
  })

  it('carries the bearer token', async () => {
    stub = installFetch(() => json(200, { entitlements: [] }))
    await fetchEntitlements()
    assert.equal(stub.calls[0]?.headers['authorization'], 'Bearer access-token')
  })

  it("returns billing's own `at`, never a locally stamped now", async () => {
    stub = installFetch(() => json(200, { at: '2026-03-04T05:06:07.000Z', entitlements: [] }))
    const answer = await fetchEntitlements()
    assert.equal(answer.at, '2026-03-04T05:06:07.000Z')
  })

  it('reports an EMPTY `at` when billing did not say — rather than inventing one', async () => {
    stub = installFetch(() => json(200, { entitlements: [] }))
    const answer = await fetchEntitlements()
    assert.equal(answer.at, '')
  })

  it('tolerates a missing entitlements key', async () => {
    stub = installFetch(() => json(200, { at: 'x' }))
    assert.deepEqual((await fetchEntitlements()).entitlements, [])
  })
})

describe('skuOf — emberkin/src/billingclient.ts', () => {
  it('strips the catalogue urn prefix', () => {
    assert.equal(skuOf('cf:catalogue:item:ember_frame'), 'ember_frame')
  })

  it('leaves a bare sku alone', () => {
    assert.equal(skuOf('ember_frame'), 'ember_frame')
  })

  it('does not strip a prefix that merely resembles it', () => {
    assert.equal(skuOf('cf:catalogue:ember_frame'), 'cf:catalogue:ember_frame')
  })

  it('handles an empty string without throwing', () => {
    assert.equal(skuOf(''), '')
  })
})

describe('matchesTitle — emberkin/src/billingclient.ts', () => {
  it('platform covers every title', () => {
    assert.equal(matchesTitle('platform', 'emberkin'), true)
    assert.equal(matchesTitle('platform', 'anything'), true)
  })

  it('title:<x> covers x', () => {
    assert.equal(matchesTitle('title:emberkin', 'emberkin'), true)
  })

  it('title:<y> does NOT cover x — a foresight cosmetic is not an Emberkin one', () => {
    assert.equal(matchesTitle('title:foresight', 'emberkin'), false)
  })

  it('a bare title name is not a scope', () => {
    // "starts with title:" would have been the lazy version, and would also have accepted
    // `title:emberkin_beta`. Equality is the rule the service uses.
    assert.equal(matchesTitle('emberkin', 'emberkin'), false)
    assert.equal(matchesTitle('title:emberkin_beta', 'emberkin'), false)
  })
})

describe('owns — the client half of emberkin/src/billingclient.ts', () => {
  it('says yes for an active, title-scoped, matching sku', () => {
    assert.equal(owns([ent()], 'ember_frame'), true)
  })

  it('says yes when the urn form is given rather than the bare sku', () => {
    assert.equal(owns([ent()], 'cf:catalogue:item:ember_frame'), true)
  })

  it('says yes for a platform-scoped cosmetic', () => {
    assert.equal(owns([ent({ scope: 'platform' })], 'ember_frame'), true)
  })

  it('says NO for an inactive entitlement', () => {
    // `active` is billing's computation at an explicit instant (`entitlements.ts`), not ours.
    assert.equal(owns([ent({ active: false })], 'ember_frame'), false)
  })

  it('says NO for a different sku', () => {
    assert.equal(owns([ent()], 'tide_frame'), false)
  })

  it('says NO for another title’s scope', () => {
    assert.equal(owns([ent({ scope: 'title:foresight' })], 'ember_frame'), false)
  })

  it('says NO on an empty list', () => {
    assert.equal(owns([], 'ember_frame'), false)
  })

  it('finds a match among several, and is not fooled by a near miss', () => {
    const list = [
      ent({ id: 'a', sku: 'other_frame' }),
      ent({ id: 'b', sku: 'ember_frame', active: false }),
      ent({ id: 'c', sku: 'ember_frame', scope: 'platform' }),
    ]
    assert.equal(owns(list, 'ember_frame'), true)
    // Remove the one that actually qualifies and the answer flips — which proves the previous
    // assertion was not passing on the inactive duplicate.
    assert.equal(owns(list.slice(0, 2), 'ember_frame'), false)
  })

  it('is asked about the emberkin title by default', () => {
    assert.equal(owns([ent({ scope: 'title:emberkin' })], 'ember_frame'), true)
    assert.equal(owns([ent({ scope: 'title:emberkin' })], 'ember_frame', 'foresight'), false)
  })
})
