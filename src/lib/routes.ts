/**
 * This app's addresses, declared once.
 *
 * Three things must agree about them: this file, the route table in `src/app.tsx`, and the
 * enumerated `location` block in `nginx.conf`. `test/routes.test.ts` checks all three against each
 * other, because a route added to the router and not to nginx works perfectly under `pnpm dev` and
 * 404s on the first hard refresh in production — a failure that survives review, since nothing
 * about the diff looks wrong.
 *
 * nginx enumerates rather than falling back because an unknown address must answer 404. See the
 * header of `nginx.conf`.
 */

export interface RouteDef {
  /** The path, without a trailing slash. The index route is `/`. */
  readonly path: string
  /** The label in the persistent HUD's navigation. Null keeps it out of the nav. */
  readonly nav: string | null
  /**
   * The page's own name, for a `<title>` and for a list of destinations — declared ONLY where
   * `nav` is null.
   *
   * `nav: null` means "keep it out of the persistent navigation", which is a different claim from
   * "this page has no name", and the two were being conflated. `/credits` is the one route that is
   * both: it is a real, linkable, public page and it is not a game section, so the not-found page
   * offered it to a lost reader as the literal string `/credits` (`route.nav ?? route.path`) and
   * the document title would have called it "Emberkin" like every other address.
   *
   * Six of the seven routes leave this undefined, because for them `nav` already IS the name and a
   * second copy of it is a second thing to keep in step. Read through {@link pageTitle}.
   */
  readonly title?: string
  /** A one-line description, used by the not-found page to offer somewhere to go. */
  readonly blurb: string
  /** Requires a session. Not a security boundary — the service checks every token. */
  readonly protected: boolean
}

export const ROUTES: readonly RouteDef[] = [
  {
    path: '/',
    nav: 'Play',
    blurb: 'Where you are, what is out there, and the fight itself.',
    protected: true,
  },
  {
    path: '/party',
    nav: 'Party',
    blurb: 'The Kin travelling with you, how deep each bond runs, and which way it leans.',
    protected: true,
  },
  {
    path: '/dex',
    nav: 'Dex',
    blurb: 'Every Kin in the world, what they are made of, and the ones you have run into.',
    protected: false,
  },
  {
    path: '/satchel',
    nav: 'Satchel',
    blurb: 'What you have on you, and what each thing does in a fight.',
    protected: true,
  },
  {
    path: '/wardrobe',
    nav: 'Wardrobe',
    blurb: 'What you can wear. None of it touches a number, and it follows your account everywhere.',
    protected: true,
  },
  {
    path: '/settings',
    nav: 'Settings',
    blurb: 'Motion, spacing, sound, and where this page sends its requests.',
    protected: false,
  },
  {
    path: '/credits',
    nav: null,
    title: 'Credits',
    blurb: 'Who made the art, how, and what is still standing in for something better.',
    protected: false,
  },
]

/** The nav, in order. Derived — never a second hand-maintained list. */
export const NAV: readonly RouteDef[] = ROUTES.filter((r) => r.nav !== null)

/**
 * Every path except the index, without its leading slash.
 *
 * This is the exact alternation nginx's `location ~ ^/(…)` block must carry. The index is excluded
 * because nginx matches `location = /` separately.
 */
export const NON_INDEX_PATHS: readonly string[] = ROUTES.filter((r) => r.path !== '/').map((r) =>
  r.path.slice(1),
)

/**
 * A route the CI image job may deep-link to and expect a 200.
 *
 * A REAL route, and one that does not require a session — the probe has no token, and a protected
 * route would still serve the shell but the assertion would be testing nginx rather than the app.
 * Passed to the workflow as `deep-link-path`.
 */
export const DEEP_LINK_PATH = '/dex'

export function routeFor(path: string): RouteDef | undefined {
  return ROUTES.find((r) => r.path === path)
}

/**
 * What to call a page — in a `<title>`, and in a list of somewhere-to-go.
 *
 * The navigation label where there is one, the declared {@link RouteDef.title} where there is not,
 * and the path as a last resort so this is a total function rather than one with a `string |
 * undefined` return that every caller has to re-decide. The last branch is unreachable today and is
 * meant to stay that way: a route added with neither name shows its own address, which is ugly
 * enough to get fixed and honest enough not to invent a name for it.
 */
export function pageTitle(route: RouteDef): string {
  return route.nav ?? route.title ?? route.path
}

/**
 * The addresses a crawler is invited to, and the only ones this surface's sitemap lists.
 *
 * ── The rule, and the one exception to it ─────────────────────────────────────────────────────
 *
 * A `protected` route redirects a signed-out reader to hub's sign-in (`ProtectedRoute` in
 * lib/auth.tsx), so a crawler is handed a sign-in journey rather than a page. `/party`, `/satchel`
 * and `/wardrobe` are therefore `noindex, nofollow`: they are one player's own screens, they carry
 * nothing a stranger can read, and a search result that lands on a redirect is a bad result.
 *
 * `/` IS protected and IS listed anyway, and that is deliberate rather than an oversight. It is
 * this surface's front door, and the ESTATE'S OWN SITEMAP already publishes it: `emberkin` is
 * `servesUi: true` in the registry, so `SITEMAP_SURFACES` in @cloudsforge/ui/sitemap includes it
 * and the apex invites crawlers to `https://emberkin.<apex>`. That module's header states the rule
 * this obeys — "a sitemap is an invitation and a robots directive is an instruction, and the two
 * must not disagree" — so a `noindex` here would put this repository in direct contradiction with
 * the front door the marketing site publishes for it. The address is the title's identity; what is
 * behind it needing a session does not change that.
 *
 * `/dex`, `/settings` and `/credits` need no exception: they are public, they render for a
 * signed-out reader, and `/dex` in particular is the fifty-Kin roster, which is the page somebody
 * searching for this game is actually looking for.
 */
export const PUBLIC_PATHS: readonly string[] = ROUTES.filter(
  (r) => r.path === '/' || !r.protected,
).map((r) => r.path)

/**
 * May a crawler index this address?
 *
 * Takes a pathname rather than a route so the catch-all answers too: an address this app does not
 * own is served with a 404 and the not-found page inside it, and that page must not be indexed
 * whatever nginx said about it.
 */
export function indexable(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname)
}
