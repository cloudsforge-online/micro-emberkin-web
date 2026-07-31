/**
 * What this account owns, read from billing.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS CALLS BILLING AND NOT EMBERKIN.
 *
 * The wardrobe has to know which cosmetics to offer, and `micro-emberkin` exposes no route that
 * returns them. Its route table is the ten in `emberkin/src/server.ts` listed at the top of
 * `./emberkin.ts`; the only entitlement path in that service is `billingclient.ts`, which calls
 * **`GET /internal/entitlements/:userId`** (`emberkin/src/billingclient.ts:72-75`) — and that route
 * refuses a user token outright: `billing/src/server.ts:505-508` throws `ForbiddenError` unless
 * `principal.kind === 'service'`. A browser cannot use it, and should not be able to.
 *
 * Billing's user-facing equivalent is **`GET /entitlements`** (`billing/src/server.ts:473`), which
 * a user token may call for itself — line 479 resolves the subject through `subjectUserId`, which
 * throws 403 if a user asks about anyone else. That is the route below, and the comment at
 * `billing/src/server.ts:502-503` says so explicitly: "Users have `GET /entitlements`, which runs
 * the same query."
 *
 * This is a gap in `micro-emberkin`, not a design: a client that must reach a second service to
 * render one screen is a client that degrades twice. It is reported upstream rather than fixed
 * here — that repository is single-owner — and the degradation is handled (see `ownership.ts`).
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import { billing } from './api.ts'

/**
 * One entitlement, as `GET /entitlements` returns it.
 *
 * `billing/src/entitlements.ts:136-156` (`toWire`). Only the fields this app reads are declared;
 * `active` is billing's own computation at an explicit instant (line 155) and is never recomputed
 * here from `expiresAt` — two services disagreeing about whether a purchase is live is precisely
 * the failure the field exists to prevent.
 */
export interface Entitlement {
  readonly id: string
  readonly sku: string
  /** `platform` or `title:<name>`. See `matchesTitle`. */
  readonly scope: string
  readonly source: string
  readonly grantedAt: string
  readonly expiresAt: string | null
  readonly active: boolean
  readonly metadata: Readonly<Record<string, unknown>>
}

/** The answer, with billing's own `at` — the instant `active` was computed. */
export interface EntitlementsAnswer {
  readonly at: string
  readonly entitlements: readonly Entitlement[]
}

/**
 * The title scope Emberkin's cosmetics are sold under.
 *
 * `emberkin/src/cosmetics.ts:16` — `export const TITLE_SCOPE = 'emberkin'`. The scope STRING on an
 * entitlement is `title:emberkin`; the bare word is what the service passes to `owns`.
 */
export const TITLE_SCOPE = 'emberkin'

/**
 * Everything this account owns.
 *
 * Deliberately UNFILTERED by scope, exactly as `emberkin/src/billingclient.ts:86-88` does it:
 * "Asked WITHOUT the scope filter and matched here, so a cross-title (`platform`-scoped) cosmetic
 * is found when Emberkin asks about it." A `?scope=` filter here would hide platform-wide
 * cosmetics from the wardrobe that the service would happily equip — the two sides would disagree
 * about what is owned, and the player would see an item they own listed as locked.
 *
 * No `userId` query parameter: `billing/src/server.ts:475-479` defaults the subject to the caller.
 * Sending one would be asking billing about ourselves the long way round, and asking about anyone
 * else is a 403 by design.
 */
export async function fetchEntitlements(): Promise<EntitlementsAnswer> {
  const body = await billing<{ at?: string; entitlements?: Entitlement[] }>('/entitlements')
  return {
    // `at` is billing's; if it is somehow absent the honest answer is that we do not know when
    // this was true, and callers render that rather than stamping `now` on someone else's data.
    at: typeof body.at === 'string' ? body.at : '',
    entitlements: body.entitlements ?? [],
  }
}

/**
 * The SKU inside an item urn, or the string itself when it is already a bare SKU.
 *
 * Byte-for-byte the same rule as `emberkin/src/billingclient.ts:55-58`. If this diverged, the
 * wardrobe would offer an item the service then refused, or hide one it would have allowed.
 */
export function skuOf(itemUrn: string): string {
  const prefix = 'cf:catalogue:item:'
  return itemUrn.startsWith(prefix) ? itemUrn.slice(prefix.length) : itemUrn
}

/**
 * Does this entitlement's scope cover a title?
 *
 * `emberkin/src/billingclient.ts:88-92`: `platform` covers everything, `title:<x>` covers x, and
 * anything else covers nothing. Reproduced rather than approximated — "starts with title:" would
 * let a `title:foresight` cosmetic into Emberkin's wardrobe.
 */
export function matchesTitle(scope: string, title: string): boolean {
  return scope === 'platform' || scope === `title:${title}`
}

/**
 * Does this account own `itemUrn`, in `title`?
 *
 * The client half of `emberkin/src/billingclient.ts:80-93`, and `test/entitlements.test.ts` drives
 * both sides of every branch — an inactive entitlement, a wrong SKU, a foreign title scope, a
 * platform scope — because a gate that only ever answers "yes" in its tests is not a gate.
 *
 * This is a DISPLAY decision, never a security one. The service checks ownership again on the
 * write (`emberkin/src/cosmetics.ts:49-51`) and refuses with a 403 that this client surfaces
 * verbatim. Hiding a locked item is a courtesy; the refusal is the boundary.
 */
export function owns(entitlements: readonly Entitlement[], itemUrn: string, title: string = TITLE_SCOPE): boolean {
  const sku = skuOf(itemUrn)
  return entitlements.some((e) => e.active && e.sku === sku && matchesTitle(e.scope, title))
}
