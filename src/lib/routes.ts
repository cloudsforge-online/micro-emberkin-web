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
  /** A one-line description, used by the not-found page to offer somewhere to go. */
  readonly blurb: string
  /** Requires a session. Not a security boundary — the service checks every token. */
  readonly protected: boolean
}

export const ROUTES: readonly RouteDef[] = [
  {
    path: '/',
    nav: 'Play',
    blurb: 'The battle view, your region, and what your Kin are doing.',
    protected: true,
  },
  {
    path: '/party',
    nav: 'Party',
    blurb: 'Your six, with their Resonance, Temperament and bond history.',
    protected: true,
  },
  {
    path: '/dex',
    nav: 'Dex',
    blurb: 'All fifty Kin, what they are made of, and which you have met.',
    protected: false,
  },
  {
    path: '/satchel',
    nav: 'Satchel',
    blurb: 'Items you are carrying.',
    protected: true,
  },
  {
    path: '/wardrobe',
    nav: 'Wardrobe',
    blurb: 'Cosmetics you own. None of them changes a number.',
    protected: true,
  },
  {
    path: '/settings',
    nav: 'Settings',
    blurb: 'Motion, contrast, and what this build is talking to.',
    protected: false,
  },
  {
    path: '/credits',
    nav: null,
    blurb: 'Where the art came from, and how it was made.',
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
