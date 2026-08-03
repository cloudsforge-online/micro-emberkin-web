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
import { CloudsForgeBar } from '@cloudsforge/ui'
import { NavLink, Outlet } from 'react-router-dom'
import { PRODUCT } from '../lib/hosts.ts'
import { useSession } from '../lib/auth.tsx'
import { useGame } from '../lib/game.tsx'
import { NAV } from '../lib/routes.ts'
import { HudStrip } from './hud.tsx'

export function AppShell() {
  const { account, signIn, signOut } = useSession()
  const { missing } = useGame()

  return (
    <>
      {/*
        The skip link is the first focusable thing in the document, and it is visually hidden until
        it TAKES FOCUS, at which point it must become visible. A skip link that stays hidden when
        focused is worse than none: a keyboard reader activates it and cannot tell whether anything
        happened. `site` and `network-site` already ship one; this shell did not, so every keyboard
        user tabbed through the whole shared bar and the sub-navigation to reach the page, on every
        navigation.
      */}
      <a className="ek-skip" href="#main">
        Skip to the page
      </a>
      <CloudsForgeBar current={PRODUCT} account={account} onSignIn={() => signIn()} onSignOut={signOut} />

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

      <main className="ek-main" id="main">
        <Outlet />
      </main>
    </>
  )
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
