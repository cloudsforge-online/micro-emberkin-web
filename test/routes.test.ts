/**
 * The three descriptions of this app's addresses, checked against each other.
 *
 *   1. `src/lib/routes.ts` — the declaration, from which the navigation is derived.
 *   2. `src/app.tsx`       — which component renders at each path.
 *   3. `nginx.conf`        — which addresses are served the app shell at all.
 *
 * The third is what makes this test worth having. nginx enumerates the real routes and 404s
 * everything else on purpose, so that a wrong address answers 404 rather than 200. The price of
 * that honesty is that a route added to the router and not to nginx works perfectly under
 * `pnpm dev` and 404s on the first hard refresh in production — a failure that survives review,
 * because nothing about the diff looks wrong. This test is the mechanism instead.
 *
 * `app.tsx` is read as TEXT rather than imported: importing would pull in React, the router and
 * every page, and this suite deliberately has no DOM.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { DEEP_LINK_PATH, NAV, NON_INDEX_PATHS, ROUTES, routeFor } from '../src/lib/routes.ts'

const read = (file: string): string => readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8')

const appSource = read('src/app.tsx')
const nginx = read('nginx.conf')
const workflow = read('.github/workflows/ci.yml')

/**
 * nginx.conf with its comments removed.
 *
 * The file's own header QUOTES the directive it forbids, in order to explain why the routes are
 * enumerated by hand. A grep over the raw text matches the warning and fails a correct file — the
 * web template's own CI has exactly that bug and fails on its own pristine config. The rule is
 * about DIRECTIVES; strip the prose before checking it.
 */
const directives = nginx
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n')

/** The alternation inside nginx's enumerated `location ~ ^/(…)` block. */
function nginxPaths(): string[] {
  const match = /location\s+~\s+\^\/worlds\/emberkin\/\(([^)]+)\)/.exec(directives)
  assert.ok(match, 'nginx.conf has no enumerated route block')
  return (match[1] ?? '').split('|').map((p) => p.trim())
}

describe('the route declaration', () => {
  it('is not empty, so this whole file cannot pass for the wrong reason', () => {
    assert.ok(ROUTES.length >= 6, `expected the route table, found ${ROUTES.length} entries`)
  })

  it('has exactly one index route', () => {
    assert.equal(ROUTES.filter((r) => r.path === '/').length, 1)
  })

  it('has no duplicate paths', () => {
    assert.equal(new Set(ROUTES.map((r) => r.path)).size, ROUTES.length)
  })

  it('spells every non-index path with a leading slash and no trailing one', () => {
    for (const route of ROUTES) {
      assert.ok(route.path.startsWith('/'), `${route.path} has no leading slash`)
      if (route.path !== '/') assert.ok(!route.path.endsWith('/'), `${route.path} has a trailing slash`)
    }
  })

  it('gives every route a blurb, because the 404 page offers them as somewhere to go', () => {
    for (const route of ROUTES) assert.ok(route.blurb.length > 0, `${route.path} has no blurb`)
  })

  it('derives the nav rather than declaring it twice', () => {
    assert.deepEqual(NAV.map((r) => r.path), ROUTES.filter((r) => r.nav !== null).map((r) => r.path))
  })

  it('keeps /credits out of the nav but in the table', () => {
    assert.equal(routeFor('/credits')?.nav, null)
    assert.ok(ROUTES.some((r) => r.path === '/credits'))
  })

  it('marks the game screens protected and the readable ones public', () => {
    assert.equal(routeFor('/')?.protected, true)
    assert.equal(routeFor('/party')?.protected, true)
    assert.equal(routeFor('/wardrobe')?.protected, true)
    // The dex is public because `GET /v1/content/dex` takes no principal (server.ts).
    assert.equal(routeFor('/dex')?.protected, false)
    assert.equal(routeFor('/settings')?.protected, false)
  })
})

describe('the router renders every declared route', () => {
  it('has a <Route> for every non-index path', () => {
    for (const path of NON_INDEX_PATHS) {
      assert.ok(appSource.includes(`path="/${path}"`), `app.tsx has no <Route path="/${path}">`)
    }
  })

  it('has an index route', () => {
    assert.match(appSource, /\bindex\b/)
  })

  it('has a catch-all that renders the not-found page', () => {
    assert.ok(appSource.includes('path="*"'), 'app.tsx has no catch-all route')
    assert.ok(appSource.includes('NotFoundPage'), 'the catch-all does not render NotFoundPage')
  })

  it('declares no route the table does not know about', () => {
    const declared = new Set(ROUTES.map((r) => r.path))
    for (const match of appSource.matchAll(/path="(\/[^"*]*)"/g)) {
      const path = match[1] as string
      assert.ok(declared.has(path), `app.tsx routes ${path}, which src/lib/routes.ts does not declare`)
    }
  })

  it('gates every protected route behind ProtectedRoute', () => {
    const protectedPaths = ROUTES.filter((r) => r.protected && r.path !== '/').map((r) => r.path)
    for (const path of protectedPaths) {
      const index = appSource.indexOf(`path="${path}"`)
      assert.ok(index > 0)
      // The element for a route is within a few lines of its path attribute.
      const window = appSource.slice(index, index + 400)
      assert.ok(window.includes('ProtectedRoute'), `${path} is declared protected but is not gated`)
    }
  })
})

describe('nginx serves every route the router owns', () => {
  it('enumerates every non-index path', () => {
    const served = nginxPaths()
    for (const path of NON_INDEX_PATHS) {
      assert.ok(served.includes(path), `nginx.conf does not serve /${path} — it will 404 on a hard refresh`)
    }
  })

  it('serves nothing the router does not declare', () => {
    for (const path of nginxPaths()) {
      assert.ok(NON_INDEX_PATHS.includes(path), `nginx.conf serves /${path}, which is not a route`)
    }
  })

  it('matches the index exactly', () => {
    assert.match(directives, /location\s+=\s+\/worlds\/emberkin\s*\{/)
  })

  it('KEEPS THE 404 — error_page, never a try_files fallback to the shell', () => {
    assert.ok(directives.includes('error_page 404 /worlds/emberkin/index.html'), 'the shell is not served through error_page')
    const banned = /try_files\s+\$uri\s+(\$uri\/\s+)?\/index\.html/
    assert.ok(!banned.test(directives), 'an unknown address would be answered 200 with the app shell')
  })

  it('404s a missing asset rather than handing it the shell', () => {
    // A JavaScript request answered with HTML fails with a syntax error naming the wrong file.
    assert.match(directives, /location \/worlds\/emberkin\/assets\/\s*\{[^}]*try_files \$uri =404/s)
  })

  it('never caches index.html — on EVERY location that serves it', () => {
    // `location = /worlds/emberkin/index.html` only matches that literal path. The front door and
    // the enumerated route block serve the same file through `try_files` without re-entering it,
    // so the header has to be repeated. The web template omits it from all of them, which would
    // leave the front door — the most-requested address in the application — with no cache
    // directive at all.
    //
    // THE FRONT DOOR IS TWO LOCATIONS SINCE THE MOUNT, and both are checked. `/worlds/emberkin`
    // and `/worlds/emberkin/` are different addresses to nginx's `=` matcher, a link in the wild
    // will use either, and a bundle that answers one and 404s the other is broken for half its
    // inbound traffic. On an apex-mounted surface there is no `location = /` to fall back on —
    // that address belongs to micro-site now.
    assert.match(directives, /location = \/worlds\/emberkin\/index\.html\s*\{[^}]*no-store/s)
    assert.match(directives, /location = \/worlds\/emberkin\s*\{[^}]*no-store/s)
    assert.match(directives, /location = \/worlds\/emberkin\/\s*\{[^}]*no-store/s)
    assert.match(directives, /location ~ \^\/worlds\/emberkin\/\([^)]+\)[^{]*\{[^}]*no-store/s)
  })

  it('REPEATS the security headers in every location that sets a header of its own', () => {
    /**
     * nginx's `add_header` inheritance is all-or-nothing per level: a location containing even one
     * `add_header` discards every one from the enclosing block. So a location that adds a
     * Cache-Control silently drops X-Content-Type-Options, X-Frame-Options and Referrer-Policy —
     * the directive it added is visible in the diff and the three it removed are not.
     *
     * The web template has exactly this bug: it sets Cache-Control inside `location /assets/` and
     * `location = /worlds/emberkin/index.html`, and therefore serves every hashed asset in every application cut
     * from it with no nosniff header. Measured against a running image, then fixed here.
     */
    const blocks = directives.match(/location[^{]*\{[^}]*\}/gs) ?? []
    assert.ok(blocks.length >= 6, `found only ${blocks.length} location blocks`)
    const withHeaders = blocks.filter((b) => b.includes('add_header'))
    assert.ok(withHeaders.length >= 6, 'expected several locations to set headers')
    for (const block of withHeaders) {
      const name = /location[^{]*/.exec(block)?.[0]?.trim() ?? '?'
      for (const header of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']) {
        assert.ok(block.includes(header), `${name} sets a header and therefore drops ${header}`)
      }
    }
  })

  it('listens on 8080, because the image is nginx-unprivileged', () => {
    assert.match(directives, /listen\s+8080;/)
  })
})

describe('the CI deep-link probe', () => {
  it('names a REAL route', () => {
    assert.ok(
      ROUTES.some((r) => r.path === DEEP_LINK_PATH),
      `${DEEP_LINK_PATH} is not a route this app declares`,
    )
  })

  it('names an UNPROTECTED route, because the probe carries no token', () => {
    assert.equal(routeFor(DEEP_LINK_PATH)?.protected, false)
  })

  it('is the path the workflow actually probes', () => {
    assert.ok(
      workflow.includes(DEEP_LINK_PATH),
      `the workflow does not mention ${DEEP_LINK_PATH}; the two have drifted`,
    )
  })

  it('the workflow also probes an address this app does NOT own, and requires 404', () => {
    assert.ok(workflow.includes('404'), 'the image job does not assert the honest 404')
  })
})
