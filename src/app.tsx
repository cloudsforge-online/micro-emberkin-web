/**
 * The route table.
 *
 * It must agree with `src/lib/routes.ts` and with the enumerated `location` block in `nginx.conf`;
 * `test/routes.test.ts` checks all three against each other. A route added here and not to nginx
 * works perfectly under `pnpm dev` and 404s on the first hard refresh in production.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * ONE LAZY BOUNDARY, AND ONLY ONE.
 *
 * `PlayPage` is `lazy()` because it — and nothing else — reaches Three.js. `three` plus the four
 * addons the stage uses is by far the largest thing in this repository's dependency tree, and a
 * player opening the dex, the wardrobe or the settings should not download a renderer to read a
 * list. Every other page is in the entry chunk, because splitting a page that renders a table buys
 * a round trip and saves nothing.
 *
 * The brief's rule — "the bundle should not balloon because a menu needed a library" — is this
 * boundary, and `test/bundle.test.ts` asserts that no module outside `src/game/` imports `three`.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/shell.tsx'
import { Loading } from './components/states.tsx'
import { AuthProvider, ProtectedRoute } from './lib/auth.tsx'
import { GameProvider } from './lib/game.tsx'
import { CreditsPage } from './pages/credits.tsx'
import { DexPage } from './pages/dex.tsx'
import { NotFoundPage } from './pages/not-found.tsx'
import { PartyPage } from './pages/party.tsx'
import { SatchelPage } from './pages/satchel.tsx'
import { SettingsPage } from './pages/settings.tsx'
import { WardrobePage } from './pages/wardrobe.tsx'

const PlayPage = lazy(async () => ({ default: (await import('./pages/play.tsx')).PlayPage }))

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GameProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route
                index
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading label="Waking the world" />}>
                      <PlayPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/party"
                element={
                  <ProtectedRoute>
                    <PartyPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/dex" element={<DexPage />} />
              <Route
                path="/satchel"
                element={
                  <ProtectedRoute>
                    <SatchelPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wardrobe"
                element={
                  <ProtectedRoute>
                    <WardrobePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/credits" element={<CreditsPage />} />
              {/*
                The catch-all renders inside the shell, so a wrong address is a page of this app
                rather than a bare error. nginx has already answered 404 for it; see nginx.conf.
              */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
