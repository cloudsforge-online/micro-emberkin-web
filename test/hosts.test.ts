/**
 * Host resolution — from the registry, like every other frontend, since the day the registry
 * gained its `emberkin` entry (`ui/packages/ui/src/surfaces.ts`).
 *
 * This header used to describe a workaround no other frontend had: the registry predated
 * Emberkin, so hosts were DERIVED from the worlds-api anchor by `deriveSurfaceUrl`. That code is
 * deleted — the promise its own header made, kept in full at last — and what this file pins now
 * is the plain thing: `hosts()` resolves the registry entry, `apiBase()` is same-origin in
 * production and the pinned devPort under `pnpm dev`, and a preview deployment's full hostname is
 * treated as the apex because `cloudsforgeHosts()` deliberately leaves an unknown subdomain alone
 * (`ui/packages/ui/src/index.tsx`).
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installWindow, removeWindow } from './browser-stubs.ts'
import { SURFACES } from '@cloudsforge/ui/surfaces'
import {
  apiBase,
  billingBase,
  hosts,
  pageOrigin,
  PRODUCT,
} from '../src/lib/hosts.ts'

afterEach(() => {
  removeWindow()
})

describe('apiBase', () => {
  beforeEach(() => {
    installWindow('http://localhost:5195/dex')
  })

  it('is the service on localhost, NOT the page origin', () => {
    // The template's `resolveApiBase` collapses to '' when the origins match, because most SPAs
    // share an origin with their API behind the gateway. Emberkin's client and service are
    // separate surfaces even in production, so a relative URL would hit the static file server.
    assert.equal(apiBase(), 'http://localhost:4100')
  })

  it('is never the empty string', () => {
    assert.notEqual(apiBase(), '')
  })

  it('uses the subdomain in production', () => {
    removeWindow()
    installWindow('https://example.com/worlds/emberkin/dex')
    assert.equal(apiBase(), 'https://example.com/worlds/emberkin')
  })

  it('resolves the same host when the page is served from another estate surface', () => {
    removeWindow()
    // `<apex>/worlds`, not `worlds.<apex>`. Forge Worlds became a folder on the apex in wave 3e of
    // the consolidation, so `worlds.` stopped being a subdomain `cloudsforgeHosts()` strips — and
    // a page opened on the old hostname would make the WHOLE name the apex, resolving this
    // surface to `<this>.worlds.example.com`, one label too deep.
    //
    // The scenario is unchanged and is the reason this fixture exists: a reader arrives here FROM
    // Forge Worlds, so the page is served from another estate surface, and this surface's own host
    // must still resolve to its own hostname rather than to something under the referrer's.
    installWindow('https://example.com/worlds/')
    assert.equal(apiBase(), 'https://example.com/worlds/emberkin')
  })

  it('is re-read per call, not cached in a module constant', () => {
    assert.equal(apiBase(), 'http://localhost:4100')
    removeWindow()
    installWindow('https://example.com/worlds/emberkin/')
    assert.equal(apiBase(), 'https://example.com/worlds/emberkin')
  })

  it('uses the port the registry records, which is the port the service binds', () => {
    // 4100 — `emberkin/src/env.ts`. The constant that used to hold this lived here because the
    // registry had no emberkin surface; it does now, so the fact has one home instead of two.
    const emberkin = SURFACES.find((x) => x.key === 'emberkin')
    assert.equal(emberkin?.devPort, 4100)
  })
})

describe('billingBase', () => {
  it('is the registry’s `pay` surface — dev port 4003', () => {
    installWindow('http://localhost:5195/')
    assert.equal(billingBase(), 'http://localhost:4003')
  })

  it('is pay.<apex> in production', () => {
    installWindow('https://example.com/worlds/emberkin/')
    assert.equal(billingBase(), 'https://pay.example.com')
  })
})

describe('pageOrigin', () => {
  it('is the window origin when there is one', () => {
    installWindow('https://example.com/worlds/emberkin/dex')
    // The ORIGIN, which never carries the mount — `window.location.origin` is scheme, host and
    // port and nothing else. Worth pinning explicitly now that the address it is read from has a
    // path in it: the two look alike in a log and are not interchangeable anywhere they are used.
    assert.equal(pageOrigin(), 'https://example.com')
  })

  it('is a stable placeholder when there is no document', () => {
    assert.equal(pageOrigin(), 'http://localhost')
  })
})

describe('the registry resolves this app without correction', () => {
  // These replace five blocks that asserted the registry was BROKEN — pinned deliberately to the
  // wrong answers so they would go red the day it was fixed. It has been: `micro-ui` now carries an
  // `emberkin` surface, so KNOWN_SUBS contains the subdomain, the apex derives correctly, and the
  // label-stripping workaround this file used to exercise is gone.
  it('strips this app\u2019s own subdomain when deriving the apex', () => {
    installWindow('https://cloudsforge.online/worlds/emberkin/dex')
    const h = hosts()
    for (const [name, url] of Object.entries(h)) {
      assert.doesNotMatch(
        String(url),
        /\.emberkin\./,
        `${name} resolved through this app\u2019s own label: ${String(url)}`,
      )
    }
  })

  it('resolves the API from the registry rather than deriving it', () => {
    installWindow('https://cloudsforge.online/worlds/emberkin/dex')
    assert.equal(apiBase(), 'https://cloudsforge.online/worlds/emberkin')
  })

  it('carries the port the service actually binds', () => {
    // 4100 — `emberkin/src/env.ts`. It was briefly registered as 3014, a free-looking number
    // chosen without reading the service, which is the same mistake that gave foresight beacon\u2019s
    // port. A devPort is a fact about a service, not an allocation.
    const emberkin = SURFACES.find((x) => x.key === 'emberkin')
    assert.ok(emberkin, 'the registry must carry an emberkin surface')
    assert.equal(emberkin.devPort, 4100)
    // NO subdomain since the nesting: the title is a folder under the catalogue, `''` + a
    // `basePath` of `/worlds/emberkin`. The devPort above is unchanged by that and is the point of
    // this test — a mount is a fact about an address, a port is a fact about a service.
    assert.equal(emberkin.subdomain, '')
    assert.equal(emberkin.basePath, '/worlds/emberkin')
  })
})

describe('the switcher marks the product this title belongs to', () => {
  it('is worlds, not emberkin', () => {
    // Emberkin is a Forge Worlds TITLE (19 §1.3), and the registry now carries an `emberkin`
    // surface — but as a service with `inSwitcher: false`, because a title is not a sixth product.
    // A player opening the switcher from inside the game should see the platform they are playing
    // on marked current, which is `worlds`.
    assert.equal(PRODUCT, 'worlds')
    const emberkin = SURFACES.find((x) => x.key === 'emberkin')
    assert.equal(emberkin?.inSwitcher, false, 'a title must not appear as a product')
  })
})
