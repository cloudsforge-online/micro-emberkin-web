/**
 * Settings: how this plays, and what it is talking to.
 *
 * The second half is not decoration. Every host on this page is resolved at RUNTIME from
 * `window.location.hostname` — there is no `.env`, no `VITE_` constant and no baked-in URL — so
 * "what is this build talking to" is a real question with an answer that changes per environment,
 * and showing it is the fastest way to diagnose a page that is pointed at the wrong estate.
 */
import { useEffect, useState } from 'react'
import { apiBase, billingBase, hosts } from '../lib/hosts.ts'
import {
  DEFAULT_PREFS,
  readPrefs,
  shouldReduceMotion,
  systemPrefersReducedMotion,
  writePrefs,
  type Prefs,
} from '../lib/prefs.ts'
import { fetchReadiness } from '../lib/emberkin.ts'

export function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [systemReduce, setSystemReduce] = useState(false)
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    setPrefs(readPrefs())
    setSystemReduce(systemPrefersReducedMotion())
  }, [])

  useEffect(() => {
    let live = true
    void fetchReadiness().then((r) => live && setReady(r.ready))
    return () => {
      live = false
    }
  }, [])

  function update(next: Prefs) {
    setPrefs(next)
    writePrefs(next)
    // Applied on `<html>` so the stylesheet's `[data-ek-reduce-motion]` rules take effect at once,
    // rather than on next load. The CSS also honours the OS media query on its own, so a user who
    // never opens this page is still covered.
    document.documentElement.dataset['ekReduceMotion'] = String(shouldReduceMotion(next, systemReduce))
    document.documentElement.dataset['ekRoomy'] = String(next.roomyHud)
  }

  const all = hosts()
  const reduced = shouldReduceMotion(prefs, systemReduce)

  return (
    <section className="ek-page">
      <h1>Settings</h1>

      <section className="ek-settings__group">
        <h2>Motion</h2>
        <fieldset>
          <legend>Reduce motion</legend>
          {(['system', 'on', 'off'] as const).map((value) => (
            <label key={value} className="ek-radio">
              <input
                type="radio"
                name="reduce-motion"
                value={value}
                checked={prefs.reduceMotion === value}
                onChange={() => update({ ...prefs, reduceMotion: value })}
              />
              <span>
                {value === 'system'
                  ? `Follow my device (currently ${systemReduce ? 'reduced' : 'full motion'})`
                  : value === 'on'
                    ? 'Always reduce'
                    : 'I did not ask for reduced motion'}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="ek-note">
          Motion is currently <strong>{reduced ? 'reduced' : 'full'}</strong>.
          {prefs.reduceMotion === 'off' && systemReduce ? (
            <>
              {' '}
              Your device asks for reduced motion, and that wins: "I did not ask for it" is not the
              same as "overrule my device".
            </>
          ) : null}
        </p>
      </section>

      <section className="ek-settings__group">
        <h2>Display</h2>
        <label className="ek-check">
          <input
            type="checkbox"
            checked={prefs.roomyHud}
            onChange={(e) => update({ ...prefs, roomyHud: e.target.checked })}
          />
          <span>More room between HUD elements</span>
        </label>
        <label className="ek-check">
          <input
            type="checkbox"
            checked={prefs.sound}
            onChange={(e) => update({ ...prefs, sound: e.target.checked })}
          />
          <span>Sound</span>
        </label>
      </section>

      <section className="ek-settings__group">
        <h2>What this build is talking to</h2>
        <p className="ek-note">
          Resolved from the address this page was served on, every time a request is made. There is
          no environment baked into this bundle, which is why one image serves localhost, a preview
          deployment and production.
        </p>
        <dl className="ek-hosts">
          <dt>Emberkin</dt>
          <dd>
            <code>{apiBase()}</code>{' '}
            {ready === null ? (
              <span className="ek-muted">— checking</span>
            ) : ready ? (
              <span>— ready</span>
            ) : (
              <span>— not ready, or not answering</span>
            )}
          </dd>
          <dt>Billing</dt>
          <dd>
            <code>{billingBase()}</code>
          </dd>
          <dt>Account (Nimbus)</dt>
          <dd>
            <code>{all.nimbus}</code>
          </dd>
          <dt>Observability (Lantern)</dt>
          <dd>
            <code>{all.lantern}</code>
          </dd>
        </dl>
        <p className="ek-note">
          Emberkin resolves from the shared surface registry like every other surface — subdomain{' '}
          <code>emberkin</code>, dev port <code className="cf-num">4100</code>, pinned there against
          the service that binds it.
        </p>
      </section>
    </section>
  )
}
