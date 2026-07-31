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
import { cloudsforgeHosts } from '@cloudsforge/ui'
import {
  apiBase,
  billingBase,
  deriveSurfaceUrl,
  EMBERKIN_DEV_PORT,
  EMBERKIN_SUBDOMAIN,
  hosts,
  pageOrigin,
  PRODUCT,
  stripOwnLabel,
} from '../src/lib/hosts.ts'

afterEach(() => {
  removeWindow()
})

describe('deriveSurfaceUrl', () => {
  it('uses the dev port on localhost', () => {
    assert.equal(
      deriveSurfaceUrl('http://localhost:4002', 'worlds-api', 'emberkin', 4100),
      'http://localhost:4100',
    )
  })

  it('uses the dev port on 127.0.0.1', () => {
    assert.equal(
      deriveSurfaceUrl('http://127.0.0.1:4002', 'worlds-api', 'emberkin', 4100),
      'http://127.0.0.1:4100',
    )
  })

  it('uses the dev port on a .local hostname', () => {
    assert.equal(
      deriveSurfaceUrl('http://mac.local:4002', 'worlds-api', 'emberkin', 4100),
      'http://mac.local:4100',
    )
  })

  it('swaps the subdomain on an apex', () => {
    assert.equal(
      deriveSurfaceUrl('https://worlds-api.example.com', 'worlds-api', 'emberkin', 4100),
      'https://emberkin.example.com',
    )
  })

  it('keeps the whole hostname as the apex on a preview deployment', () => {
    // `cloudsforgeHosts()` leaves an unknown prefix alone, so the anchor arrives with the preview
    // host already in it. Guessing at a shorter apex here would point at nothing.
    assert.equal(
      deriveSurfaceUrl('https://worlds-api.pr-42.example.dev', 'worlds-api', 'emberkin', 4100),
      'https://emberkin.pr-42.example.dev',
    )
  })

  it('prepends rather than replacing when the anchor somehow carries no subdomain', () => {
    assert.equal(
      deriveSurfaceUrl('https://example.com', 'worlds-api', 'emberkin', 4100),
      'https://emberkin.example.com',
    )
  })

  it('keeps the protocol — http stays http, https stays https', () => {
    assert.equal(
      deriveSurfaceUrl('http://worlds-api.example.com', 'worlds-api', 'emberkin', 4100),
      'http://emberkin.example.com',
    )
  })

  it('never returns a trailing slash, which would double up against a leading-slash path', () => {
    for (const anchor of ['http://localhost:4002', 'https://worlds-api.example.com']) {
      assert.ok(!deriveSurfaceUrl(anchor, 'worlds-api', 'emberkin', 4100).endsWith('/'))
    }
  })
})

describe('apiBase', () => {
  beforeEach(() => {
    installWindow('http://localhost:5195/dex')
  })

  it('is the service on localhost, NOT the page origin', () => {
    // The template's `resolveApiBase` collapses to '' when the origins match, because most SPAs
    // share an origin with their API behind the gateway. Emberkin's client and service are
    // separate surfaces even in production, so a relative URL would hit the static file server.
    assert.equal(apiBase(), `http://localhost:${EMBERKIN_DEV_PORT}`)
  })

  it('is never the empty string', () => {
    assert.notEqual(apiBase(), '')
  })

  it('uses the subdomain in production', () => {
    removeWindow()
    installWindow('https://emberkin.example.com/dex')
    assert.equal(apiBase(), `https://${EMBERKIN_SUBDOMAIN}.example.com`)
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

  it('names the dev port emberkin/src/env.ts:121 defaults to', () => {
    assert.equal(EMBERKIN_DEV_PORT, 4100)
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

describe('THE REGISTRY CANNOT RESOLVE THE APEX FROM THIS APP\u2019S OWN HOSTNAME', () => {
  /**
   * The defect, measured rather than argued about.
   *
   * `KNOWN_SUBS` is built from the registry's own subdomains
   * (`ui/packages/ui/src/surfaces.ts:521-525`) and `emberkin` is not one, so
   * `cloudsforgeHosts()` leaves the prefix alone and treats the WHOLE hostname as the apex. That
   * is correct behaviour for a preview deployment and wrong for this app in production.
   *
   * These first assertions pin the WRONG answer on purpose. If micro-ui ever gains an `emberkin`
   * entry, they fail — which is exactly the signal to delete the correction below along with
   * them, rather than leaving a rewrite running against a registry that no longer needs it.
   */
  beforeEach(() => {
    installWindow('https://emberkin.example.com/dex')
  })

  it('resolves nimbus to a hostname that does not exist', () => {
    assert.equal(cloudsforgeHosts().nimbus, 'https://nimbus.emberkin.example.com')
  })

  it('resolves billing to a hostname that does not exist', () => {
    assert.equal(cloudsforgeHosts().pay, 'https://pay.emberkin.example.com')
  })

  it('resolves the telemetry ingest to a hostname that does not exist', () => {
    assert.equal(cloudsforgeHosts().lantern, 'https://lantern.emberkin.example.com')
  })

  it('hosts() CORRECTS every one of them', () => {
    const h = hosts()
    assert.equal(h.nimbus, 'https://nimbus.example.com')
    assert.equal(h.pay, 'https://pay.example.com')
    assert.equal(h.lantern, 'https://lantern.example.com')
    assert.equal(h.account, 'https://account.example.com')
  })

  it('corrects every key, not just the four the app happens to name', () => {
    for (const [key, url] of Object.entries(hosts())) {
      assert.ok(!url.includes('.emberkin.'), `${key} still carries the stray label: ${url}`)
    }
  })

  it('leaves a surface with a basePath usable — the path survives the rewrite', () => {
    // The wallet is a path inside Hub (`surfaces.ts` `basePath`). A naive `new URL().toString()`
    // round trip must not drop it.
    const wallet = hosts().wallet
    assert.ok(wallet.startsWith('https://'), wallet)
    assert.ok(!wallet.includes('.emberkin.'), wallet)
  })
})

describe('hosts() is a no-op everywhere else', () => {
  it('changes nothing on localhost', () => {
    installWindow('http://localhost:5195/')
    assert.deepEqual(hosts(), cloudsforgeHosts())
  })

  it('changes nothing when served from the apex', () => {
    installWindow('https://example.com/')
    assert.deepEqual(hosts(), cloudsforgeHosts())
  })

  it('changes nothing when served from another estate surface', () => {
    installWindow('https://worlds.example.com/')
    assert.deepEqual(hosts(), cloudsforgeHosts())
  })

  it('changes nothing on a preview deployment', () => {
    installWindow('https://pr-42.example.dev/')
    assert.deepEqual(hosts(), cloudsforgeHosts())
  })
})

describe('stripOwnLabel', () => {
  it('removes the label when it sits second', () => {
    assert.equal(stripOwnLabel('https://nimbus.emberkin.example.com', 'emberkin'), 'https://nimbus.example.com')
  })

  it('leaves the label alone when it sits FIRST — that is this app\u2019s own host', () => {
    assert.equal(stripOwnLabel('https://emberkin.example.com', 'emberkin'), 'https://emberkin.example.com')
  })

  it('leaves a URL that does not carry the label at all', () => {
    assert.equal(stripOwnLabel('https://nimbus.example.com', 'emberkin'), 'https://nimbus.example.com')
  })

  it('keeps a path', () => {
    assert.equal(stripOwnLabel('https://hub.emberkin.example.com/wallet', 'emberkin'), 'https://hub.example.com/wallet')
  })

  it('keeps a port', () => {
    assert.equal(stripOwnLabel('https://a.emberkin.example.com:8443', 'emberkin'), 'https://a.example.com:8443')
  })

  it('returns an unparseable string unchanged rather than throwing', () => {
    assert.equal(stripOwnLabel('not a url', 'emberkin'), 'not a url')
  })

  it('refuses to strip when doing so would leave no apex', () => {
    assert.equal(stripOwnLabel('https://a.emberkin', 'emberkin'), 'https://a.emberkin')
  })
})

describe('the registry entries this app relies on', () => {
  beforeEach(() => {
    installWindow('http://localhost:5195/')
  })

  it('presents itself as `worlds`, because there is no `emberkin` key yet', () => {
    assert.equal(PRODUCT, 'worlds')
  })

  it('still has the anchor surface it derives from', () => {
    // If `worlds-api` were ever removed from the registry, `apiBase()` would resolve to
    // `undefined` and every request would go to the string "undefined". This is what catches that.
    assert.ok(hosts()['worlds-api'], 'the worlds-api anchor is gone from the registry')
  })

  it('still has the billing surface', () => {
    assert.ok(hosts().pay)
  })

  it('has the surfaces the shared auth client needs', () => {
    assert.ok(hosts().nimbus)
    assert.ok(hosts().lantern)
    assert.ok(hosts().account)
  })

  it('genuinely has NO emberkin key — the premise of the workaround, asserted', () => {
    // When this fails, delete deriveSurfaceUrl, set PRODUCT to 'emberkin', and delete this test.
    assert.equal((hosts() as Record<string, string>)['emberkin'], undefined)
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
