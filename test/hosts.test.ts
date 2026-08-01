/**
 * Host resolution, including the workaround this repository has and no other frontend does.
 *
 * `@cloudsforge/ui`'s surface registry has no `emberkin` key — `SurfaceKey` at
 * `ui/packages/ui/src/surfaces.ts:23-36` enumerates every surface and Emberkin is not among them,
 * because it was added to the programme after the registry was written. `micro-ui` is single-owner
 * and this repository does not edit it, so `deriveSurfaceUrl` builds the host from a registry entry
 * that DOES exist.
 *
 * The case worth pinning is the third one: `cloudsforgeHosts()` deliberately leaves an unknown
 * subdomain alone (`ui/packages/ui/src/index.tsx:149-158`), so on a preview deployment the whole
 * hostname is the apex, and a derivation that guessed at a shorter one would send every request
 * somewhere that does not exist.
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
    installWindow('https://emberkin.example.com/dex')
    assert.equal(apiBase(), 'https://emberkin.example.com')
  })

  it('resolves the same host when the page is served from another estate surface', () => {
    removeWindow()
    installWindow('https://worlds.example.com/')
    assert.equal(apiBase(), 'https://emberkin.example.com')
  })

  it('is re-read per call, not cached in a module constant', () => {
    assert.equal(apiBase(), 'http://localhost:4100')
    removeWindow()
    installWindow('https://emberkin.example.com/')
    assert.equal(apiBase(), 'https://emberkin.example.com')
  })

  it('uses the port the registry records, which is the port the service binds', () => {
    // 4100 — `emberkin/src/env.ts:121`. The constant that used to hold this lived here because the
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
    installWindow('https://emberkin.example.com/')
    assert.equal(billingBase(), 'https://pay.example.com')
  })
})

describe('pageOrigin', () => {
  it('is the window origin when there is one', () => {
    installWindow('https://emberkin.example.com/dex')
    assert.equal(pageOrigin(), 'https://emberkin.example.com')
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
    installWindow('https://emberkin.cloudsforge.online/dex')
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
    installWindow('https://emberkin.cloudsforge.online/dex')
    assert.equal(apiBase(), 'https://emberkin.cloudsforge.online')
  })

  it('carries the port the service actually binds', () => {
    // 4100 — `emberkin/src/env.ts:121`. It was briefly registered as 3014, a free-looking number
    // chosen without reading the service, which is the same mistake that gave foresight beacon\u2019s
    // port. A devPort is a fact about a service, not an allocation.
    const emberkin = SURFACES.find((x) => x.key === 'emberkin')
    assert.ok(emberkin, 'the registry must carry an emberkin surface')
    assert.equal(emberkin.devPort, 4100)
    assert.equal(emberkin.subdomain, 'emberkin')
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
