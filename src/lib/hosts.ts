/**
 * Where this app talks to, resolved at runtime.
 *
 * `cloudsforgeHosts()` reads `window.location.hostname` on every call, so the same bundle
 * addresses `http://localhost:4100` when served from localhost and `https://emberkin.<apex>` when
 * served from the apex. Nothing here reads a build-time constant; see the note in vite.config.ts.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE ONE THING THAT IS NOT LIKE THE OTHER FRONTENDS.
 *
 * `@cloudsforge/ui`'s surface registry has no `emberkin` key. `SurfaceKey` in
 * `ui/packages/ui/src/surfaces.ts:23-36` enumerates every addressable surface and Emberkin is not
 * among them, because Emberkin was added to the programme after the registry was written
 * (docs/ecosystem/19-new-products.md, added 2026-07-31). `micro-ui` is single-owner and this
 * repository does not edit it, so the host is DERIVED from a registry entry rather than declared.
 *
 * `deriveSurfaceUrl` takes an anchor — a surface that IS in the registry, resolved by
 * `cloudsforgeHosts()` — and swaps its subdomain, or its dev port on localhost. That keeps the
 * environment logic in exactly one place (the registry's) and adds only the two facts the registry
 * does not yet carry: the subdomain `emberkin` and the dev port 4100, which is
 * `emberkin/src/env.ts:121` (`integer(source, 'PORT', 4100, …)`).
 *
 * WHEN THE REGISTRY GAINS AN `emberkin` ENTRY, this file loses `deriveSurfaceUrl`,
 * `EMBERKIN_SUBDOMAIN`, `EMBERKIN_DEV_PORT` and their test, `PRODUCT` becomes `'emberkin'`, and
 * `apiBase()` becomes the one-line resolution every other frontend has. Nothing else moves. That
 * deletion is the point of keeping the workaround this small.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import { cloudsforgeHosts, type CloudsForgeHosts, type SurfaceKey } from '@cloudsforge/ui'

/**
 * The surface this application presents itself AS, for the product switcher.
 *
 * Emberkin is a Forge Worlds title (19 §1.3), so `worlds` is the entry the bar marks current —
 * which is true rather than merely convenient: a player who opens the switcher from inside the
 * game should see the platform they are playing on highlighted.
 */
export const PRODUCT: SurfaceKey = 'worlds'

/** The name reported to the observability ingest and shown in error copy. */
export const APP_NAME = 'emberkin-web'

/** Emberkin's own subdomain, pending a registry entry. See the header. */
export const EMBERKIN_SUBDOMAIN = 'emberkin'

/** Emberkin's dev port. `emberkin/src/env.ts:121` — `integer(source, 'PORT', 4100, 1, 65_535)`. */
export const EMBERKIN_DEV_PORT = 4100

/**
 * The anchor surface whose resolved URL tells us which environment we are in.
 *
 * `worlds-api` rather than `worlds`: it is a `service` kind with a plain subdomain and no
 * `basePath`, so stripping its first label yields the apex without further care.
 * `ui/packages/ui/src/surfaces.ts:457-468`.
 */
const ANCHOR: SurfaceKey = 'worlds-api'
const ANCHOR_SUBDOMAIN = 'worlds-api'

function isLocal(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')
}

/**
 * Resolve a surface the registry does not carry, from one it does.
 *
 * Pure and exported so a test can drive it with every environment the registry produces — a
 * localhost port, an apex subdomain, and a preview deployment whose hostname is its own apex. The
 * last is the case worth pinning: `cloudsforgeHosts()` deliberately leaves an unknown prefix alone
 * (`ui/packages/ui/src/index.tsx:149-158`), so on `pr-42.example.dev` the anchor comes back as
 * `https://worlds-api.pr-42.example.dev` and this must produce `https://emberkin.pr-42.example.dev`
 * rather than guessing at a shorter apex.
 */
export function deriveSurfaceUrl(
  anchorUrl: string,
  anchorSubdomain: string,
  subdomain: string,
  devPort: number,
): string {
  const url = new URL(anchorUrl)
  if (isLocal(url.hostname)) return `${url.protocol}//${url.hostname}:${devPort}`
  const prefix = `${anchorSubdomain}.`
  // The anchor always carries its own subdomain in production. If it somehow does not, the
  // hostname IS the apex and prepending is still correct.
  const apex = url.hostname.startsWith(prefix) ? url.hostname.slice(prefix.length) : url.hostname
  return `${url.protocol}//${subdomain}.${apex}`
}

/** Every CloudsForge base URL the registry knows, for the current environment. */
export function hosts(): CloudsForgeHosts {
  return cloudsforgeHosts()
}

/**
 * The base URL of `micro-emberkin`, resolved now.
 *
 * Call it per request; never cache it in a module constant — the registry resolves from
 * `window.location.hostname`, which a test may change between calls.
 *
 * Unlike the template's `apiBase()` this never collapses to the empty string. The template's does
 * because an SPA and its API usually share an origin behind the gateway; Emberkin's client and
 * service are separate surfaces even in production, so the request is always absolute and always
 * cross-origin. Pretending otherwise would send every call to the static file server.
 */
export function apiBase(): string {
  return deriveSurfaceUrl(hosts()[ANCHOR], ANCHOR_SUBDOMAIN, EMBERKIN_SUBDOMAIN, EMBERKIN_DEV_PORT)
}

/**
 * Billing's base URL, for the ONE read this client makes of it: what the account owns.
 *
 * `pay` is billing in the registry (`ui/packages/ui/src/surfaces.ts:472-483`). The wardrobe needs
 * the entitlement list to know which cosmetics to offer, and `micro-emberkin` exposes no route
 * that returns it — see the note on `listEntitlements` in ./billing.ts.
 */
export function billingBase(): string {
  return hosts().pay
}

/** The page origin, or a stable placeholder when there is no document (tests, prerender). */
export function pageOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin
}
