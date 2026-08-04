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
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE PART THAT IS A REAL DEFECT, NOT AN INCONVENIENCE.
 *
 * `cloudsforgeHosts()` derives the apex by stripping a KNOWN subdomain from the browser's
 * hostname, and `KNOWN_SUBS` is built from the registry's own subdomains
 * (`ui/packages/ui/src/surfaces.ts:521-525`). `emberkin` is not one, so an unknown prefix is left
 * alone by design (`ui/packages/ui/src/index.tsx:149-158`) — which is correct for a preview
 * deployment and wrong for this app in production. Served from `https://emberkin.<apex>`, the
 * registry resolves:
 *
 *     nimbus  → https://nimbus.emberkin.<apex>     ← does not exist
 *     pay     → https://pay.emberkin.<apex>        ← does not exist
 *     lantern → https://lantern.emberkin.<apex>    ← does not exist
 *
 * Sign-in, billing and telemetry would every one of them address a hostname that is not there.
 * Measured, not reasoned about: `test/hosts.test.ts` drives `cloudsforgeHosts()` from that
 * hostname and asserts the wrong answer, so the defect cannot be quietly "fixed" by assumption.
 *
 * `hosts()` therefore CORRECTS the registry's answer rather than passing it through: when the page
 * is served from `emberkin.<something>`, the stray label is removed from every resolved URL. It is
 * a mechanical rewrite of a string the registry produced, confined to this file, and it is a
 * no-op in every other environment — localhost, an apex, a preview deployment.
 *
 * THE REGISTRY GAINED ITS `emberkin` ENTRY (`ui/packages/ui/src/surfaces.ts:404`) and the block
 * this header promised to delete — `deriveSurfaceUrl`, `stripOwnLabel`, `EMBERKIN_SUBDOMAIN`,
 * `EMBERKIN_DEV_PORT` — is gone, in full. The rewire happened in two halves months apart, which
 * is exactly what a promised-deletion comment exists to prevent, and only half-happened anyway:
 * `hosts()` was repointed but all four exports survived, still imported by the settings screen.
 *
 * One clause of the promise is deliberately NOT honoured: `PRODUCT` stays `'worlds'`. The comment
 * beside it argues the truer position — a title highlights the platform it runs on — and the
 * registry's `emberkin` entry is `inSwitcher: false`, so marking `'emberkin'` current would
 * highlight nothing at all.
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
/**
 * The surface this application IS, for the footer. **Deliberately not `'worlds'`.**
 *
 * The two constants answer two different questions and collapsing them would make one of them
 * wrong. `PRODUCT` is what the BAR marks current, and the switcher is a list of platforms a
 * player chooses between — Emberkin is played through Forge Worlds, so `worlds` is the honest
 * highlight there. The FOOTER lists surfaces, and Emberkin is one: it has its own registry row and
 * its own hostname (`emberkin` in @cloudsforge/ui's surfaces.ts). So "you are here" in the footer is
 * Emberkin, and the footer's closing line reads Emberkin's own blurb rather than Forge Worlds'.
 */
export const FOOTER_SURFACE: SurfaceKey = 'emberkin'


/** The name reported to the observability ingest and shown in error copy. */
export const APP_NAME = 'emberkin-web'


/**
 * Every CloudsForge base URL the registry knows, for the current environment — corrected.
 *
 * See the header. The correction fires only when the page is served from `emberkin.<something>`,
 * which is the one case the registry cannot resolve because it has no entry for this surface.
 */
export function hosts(): CloudsForgeHosts {
  // Passed through, untouched. This used to strip `emberkin.` from every resolved URL, because
  // the registry had no `emberkin` surface and so could not recognise it as a known subdomain —
  // served from `emberkin.<apex>` it resolved identity, billing and telemetry to
  // `nimbus.emberkin.<apex>` and friends, three hostnames that do not exist. The registry now
  // carries the surface, KNOWN_SUBS contains it, and the correction is gone.
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
  // Straight from the registry now that `emberkin` is a surface in it. This used to derive the URL
  // from `worlds-api` by swapping labels and forcing a port, because there was nothing to read.
  return new URL(hosts().emberkin).origin
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
