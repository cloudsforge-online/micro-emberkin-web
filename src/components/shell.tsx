/**
 * The app shell: the company bar, the persistent HUD, and the page.
 *
 * The bar is `CloudsForgeBar` from @cloudsforge/ui and is never reimplemented — it is what makes
 * moving between surfaces feel like one application. Everything this app adds goes BELOW it.
 *
 * The HUD is persistent because this is a game: your party's condition and where you are should be
 * legible from every screen, not only from the one that happens to be about them. It is also the
 * whole navigation, so it is a `<nav>` with real links and a real current-page marker, and it is
 * keyboard navigable in source order.
 */
import { useEffect, useState } from 'react'
import {
  CloudsForgeBar,
  CloudsForgeFooter,
  CookieBanner,
  MainRegion,
  SkipLink,
  miningOnHub,
} from '@cloudsforge/ui'
import { applyHead, surfaceMeta } from '@cloudsforge/ui/seo'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { PRODUCT, SURFACE, hosts } from '../lib/hosts.ts'
import { useSession } from '../lib/auth.tsx'
import { useGame } from '../lib/game.tsx'
import { NAV, indexable, pageTitle, routeFor } from '../lib/routes.ts'
import { HudStrip } from './hud.tsx'
import { setViewedNetwork, viewedNetwork, type ViewedNetwork } from '../lib/viewed.ts'

export function AppShell() {
  // The viewed network: in-tab memory, defaulting to the hostname's own (micro-org#459).
  // `setViewedNetwork` runs first in the handler below so the remounted tree reads the new value
  // on its very first render.
  const [viewed, setViewed] = useState<ViewedNetwork>(viewedNetwork())
  const { account, signIn, signOut } = useSession()
  const { missing } = useGame()

  return (
    <>
      <DocumentMeta />
      {/*
        The skip link is the first focusable thing in the document, and it is now the SHARED one.
        This app had its own — a `.ek-skip` anchor pointing at `#main` — and it was half of the
        pattern: `<main id="main">` carried no `tabIndex={-1}`, so in Chrome and Safari following
        the link scrolled the page, left focus on the link, and sent the next Tab back into the
        company bar. On this surface the block being bypassed is the longest in the estate — the
        company bar, six game sections and the persistent HUD's six party slots — so it was also
        the surface where getting it half right cost the most.

        `MainRegion` below is the half that was missing; the two now come from one constant.
      */}
      <SkipLink>Skip to the page</SkipLink>
      {/*
        `mining` beside the account, as on the other nine player-facing surfaces. This one was
        missed when the control was added — measured 2026-08-10: eleven of eighteen frontends
        passed it and this was the only surface that mounts the bar, carries a real session and
        did not. A control that is present on nine surfaces and absent on the tenth is the same
        "where has it gone" the subpage was.

        `miningOnHub()` and not a live session: the miner is a WebSocket and two Web Workers on
        ONE origin, and `hub.<apex>` is not this one. So this renders an anchor to the surface
        that can start it. `hosts().hub` rather than a literal, because this bundle is served from
        localhost, from a preview host and from the apex.
      */}
      {/*
        In-app network context (micro-org#459, the combined view). The reader's choice lives in
        `lib/viewed.ts` — module memory, never storage — and the `key` on the Outlet below is the
        refetch mechanism: switching remounts the page tree, and `apiBase()` reads `viewedHosts()`,
        so the same page re-reads itself from the other estate WITHOUT going anywhere. The band and
        the switcher both follow the selection, so testnet data under a mainnet address bar is
        never unmarked. The bar also stamps `?net=` onto its product links, which is what carries
        the choice across a product switch — every surface is its own origin, so nothing else can.
      */}
      <CloudsForgeBar
        current={PRODUCT}
        account={account}
        onSignIn={() => signIn()}
        onSignOut={signOut}
        mining={miningOnHub(hosts().hub)}
        networkSwitch={{
          selected: viewed,
          onSelect: (n) => {
            setViewedNetwork(n)
            setViewed(n)
          },
        }}
      />

      {/*
        Sticky at exactly `var(--cf-bar-h)` — the bar's own height token, not a number copied out
        of it. When the bar's height changes this moves with it; a hard-coded 46px would leave a
        seam that only appears on the surfaces nobody rechecked.
      */}
      <nav className="ek-nav" aria-label="Game sections">
        <div className="ek-nav__inner">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `ek-nav__link${isActive ? ' is-active' : ''}`}
            >
              {item.nav}
            </NavLink>
          ))}
        </div>
      </nav>

      <HudStrip />

      {/*
        One banner, at the top of every page, naming what is unavailable. It is `role="status"`
        rather than `alert`: the app still works, and a screen reader being interrupted by a
        degradation notice on every navigation is worse than being told once, politely.
      */}
      {missing.length > 0 && (
        <div className="ek-degraded" role="status">
          <span className="ek-degraded__icon" aria-hidden="true">
            ▲
          </span>
          <p>
            Playing without {joinWords(missing)}. Everything else on this page is live.
          </p>
        </div>
      )}

      {/*
        `MainRegion` rather than a hand-written `<main>`: it sets `id={MAIN_ID}` and `tabIndex={-1}`
        together, which is the pair the skip link needs and the pair this file used to get half
        right. The id is `cf-main` now, not `main` — nothing else in this app referenced the old
        one, and the shared `SkipLink` composes its href from the same constant, so the two cannot
        disagree. `ek-main` keeps every layout rule this page already had.
      */}
      <MainRegion className="ek-main">
        <Outlet key={viewed} />
      </MainRegion>

      {/*
        The company footer, from @cloudsforge/ui. Every link in it is derived from the surface
        registry, so a new product appears here without this file changing — which is the reason
        the estate is not growing a fifth hand-rolled footer beside the four it already had.

        `current` is SURFACE, not the bar's PRODUCT: see lib/hosts.ts for why those are two
        different questions. `account` decides only whether the operator surfaces are offered.
      */}
      <CloudsForgeFooter current={SURFACE} account={account} />

      {/*
        Last in the document, and therefore last in the tab order. That is deliberate: the banner
        is a dialog and is explicitly NOT modal, so a player who came here to look something up in
        the dex can look it up and answer afterwards. A consent banner that traps focus is the
        coercion the regulation is about — and on a surface where the reader may be mid-battle,
        trapping them is also simply taking the game away.

        It renders nothing at all until it knows the reader has not already answered, and nothing on
        an origin where analytics would not report anyway, which is every local stack.
      */}
      <CookieBanner />
    </>
  )
}

/**
 * Keep `document.title`, the description, the Open Graph tags and the canonical link in step with
 * the address.
 *
 * A component in the shell rather than a hook called by each page, because the failure mode of the
 * second shape is the page that forgets to call it — and the page that forgets is the one added
 * last, which is the one nobody has bookmarked yet and therefore the one nobody notices is titled
 * with the previous page's title.
 *
 * ── What this does NOT replace ────────────────────────────────────────────────────────────────
 *
 * The static tags in `index.html`. They are what a link-preview fetcher gets — the ones used by
 * chat and social clients generally do not execute JavaScript — so the shell keeps its own title,
 * description and card, and this is the layer a browser and the crawlers that do execute
 * JavaScript see. That trade is inherited rather than introduced; it is written down at the top of
 * `@cloudsforge/ui/seo`.
 *
 * ── Where the words come from ─────────────────────────────────────────────────────────────────
 *
 * `surfaceMeta(SURFACE, …)` — `SURFACE`, which is `'emberkin'`, and NOT `PRODUCT`, which is
 * `'worlds'`. The two constants exist because they answer different questions (lib/hosts.ts says
 * which), and this is the question they most obviously answer differently: the registry's
 * `emberkin` row carries this game's own name and its own blurb — "A monster-collecting RPG,
 * played through Forge Worlds" — while the `worlds` row carries the platform's. Titling every page
 * of Emberkin "Forge Worlds" would have been a wrong answer that looked deliberate.
 *
 * Which page you are on is read off `ROUTES` through {@link pageTitle}, the same declaration the
 * navigation, the router and nginx are all derived from, rather than typed a fifth time.
 *
 * ── And which pages a crawler is told to leave alone ──────────────────────────────────────────
 *
 * `indexable()` decides, and the reasoning is beside it in lib/routes.ts. In short: a route behind
 * `ProtectedRoute` hands a crawler a sign-in redirect rather than a page, so `/party`, `/satchel`
 * and `/wardrobe` are `noindex, nofollow` — as is any address this app does not own, which is
 * already served with a 404 and must not be indexed on top of it.
 */
function DocumentMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const route = routeFor(pathname)
    const title = route === undefined ? undefined : pageTitle(route)
    applyHead(
      surfaceMeta(SURFACE, {
        ...(title === undefined ? {} : { title }),
        path: pathname,
        ...(indexable(pathname) ? {} : { robots: 'noindex, nofollow' }),
      }),
      window.location.origin,
    )
  }, [pathname])

  return null
}

/**
 * "a, b and c" — an Oxford-less list, because this is British English copy and the sentence it
 * lands in is short.
 *
 * Exported for the degradation test: the banner's wording is the user-visible half of rule 3, and
 * a list that reads "a,b,c" when three things are down is the kind of thing nobody notices until
 * the day three things are down.
 */
export function joinWords(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0] as string
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] as string}`
}
