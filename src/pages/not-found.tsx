/**
 * The page for an address this app does not own.
 *
 * It is served with a **404 status**, not a 200. `nginx.conf` enumerates the real routes and falls
 * through to `error_page 404 /index.html`, which serves this same bundle while KEEPING the status
 * line. The usual SPA `try_files $uri /index.html` would make every wrong address a success: search
 * engines index it, uptime checks call it healthy, link checkers pass, and a deploy that dropped a
 * route would look exactly like a deploy that did not.
 *
 * So the copy can say "this is a 404" and be telling the truth, and the page offers the real routes
 * from the same declaration the router and nginx are built from — a list that cannot go stale.
 */
import { Link, useLocation } from 'react-router-dom'
import { ROUTES, pageTitle } from '../lib/routes.ts'
import { titleArt } from '../lib/art.ts'

export function NotFoundPage() {
  const location = useLocation()
  const mark = titleArt('mark')

  return (
    <section className="ek-page ek-notfound">
      {mark ? <img className="ek-notfound__mark" src={mark} alt="" aria-hidden="true" width={96} height={96} /> : null}
      <h1>There is nothing at this address</h1>
      <p className="ek-notfound__path">
        The server answered <strong>404</strong> for <code className="cf-num">{location.pathname}</code>, and this
        page is that 404 — not a success pretending to be one.
      </p>
      <nav aria-label="Where you can go">
        <ul className="ek-notfound__routes">
          {ROUTES.map((route) => (
            <li key={route.path}>
              {/* `pageTitle`, not `route.nav ?? route.path`: `nav: null` means "not in the game
                  navigation", not "has no name", and the difference was visible right here —
                  /credits was offered to a lost reader as the string "/credits". */}
              <Link to={route.path}>{pageTitle(route)}</Link>
              <span className="ek-muted"> — {route.blurb}</span>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}
