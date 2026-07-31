/**
 * Preferences, and the one decision in them worth arguing about.
 *
 * `shouldReduceMotion` lets the OS win over an in-app "off". That is deliberate: "off" means
 * "I did not ask for reduced motion", not "overrule my operating system's accessibility setting" —
 * and a user who has told their OS that motion makes them ill has said something this app is not
 * entitled to overturn from a checkbox they may have ticked before they knew what it did.
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installStorage, removeStorage } from './browser-stubs.ts'
import { DEFAULT_PREFS, readPrefs, shouldReduceMotion, systemPrefersReducedMotion, writePrefs } from '../src/lib/prefs.ts'

let store: Map<string, string>

beforeEach(() => {
  store = installStorage()
})

afterEach(() => {
  removeStorage()
})

describe('shouldReduceMotion — the truth table', () => {
  it('system + OS asks → reduced', () => {
    assert.equal(shouldReduceMotion({ ...DEFAULT_PREFS, reduceMotion: 'system' }, true), true)
  })

  it('system + OS silent → full motion', () => {
    assert.equal(shouldReduceMotion({ ...DEFAULT_PREFS, reduceMotion: 'system' }, false), false)
  })

  it('on + OS silent → reduced, because an explicit choice beats the OS in the accessible direction', () => {
    assert.equal(shouldReduceMotion({ ...DEFAULT_PREFS, reduceMotion: 'on' }, false), true)
  })

  it('on + OS asks → reduced', () => {
    assert.equal(shouldReduceMotion({ ...DEFAULT_PREFS, reduceMotion: 'on' }, true), true)
  })

  it('off + OS silent → full motion', () => {
    assert.equal(shouldReduceMotion({ ...DEFAULT_PREFS, reduceMotion: 'off' }, false), false)
  })

  it('OFF + OS ASKS → STILL REDUCED. The row this whole file exists for.', () => {
    assert.equal(shouldReduceMotion({ ...DEFAULT_PREFS, reduceMotion: 'off' }, true), true)
  })

  it('defaults to following the OS', () => {
    assert.equal(DEFAULT_PREFS.reduceMotion, 'system')
    assert.equal(shouldReduceMotion(DEFAULT_PREFS, true), true)
  })
})

describe('readPrefs', () => {
  it('is the defaults when nothing is stored', () => {
    assert.deepEqual(readPrefs(), DEFAULT_PREFS)
  })

  it('round-trips what was written', () => {
    writePrefs({ reduceMotion: 'on', roomyHud: true, sound: false })
    assert.deepEqual(readPrefs(), { reduceMotion: 'on', roomyHud: true, sound: false })
  })

  it('validates each field to its own domain rather than spreading the stored object', () => {
    // `{...DEFAULT, ...JSON.parse(raw)}` would take `reduceMotion: "yes"` — written by a future
    // version, or by somebody in devtools — and the app would compare it against 'on' forever and
    // quietly do nothing.
    store.set('emberkin.prefs', JSON.stringify({ reduceMotion: 'yes', roomyHud: 'true', sound: 1 }))
    assert.deepEqual(readPrefs(), DEFAULT_PREFS)
  })

  it('keeps the valid fields when only one is nonsense', () => {
    store.set('emberkin.prefs', JSON.stringify({ reduceMotion: 'on', roomyHud: 'nope', sound: false }))
    assert.deepEqual(readPrefs(), { reduceMotion: 'on', roomyHud: false, sound: false })
  })

  it('is the defaults for unparseable JSON', () => {
    store.set('emberkin.prefs', 'not json')
    assert.deepEqual(readPrefs(), DEFAULT_PREFS)
  })

  it('is the defaults for a JSON value that is not an object', () => {
    store.set('emberkin.prefs', '"a string"')
    assert.deepEqual(readPrefs(), DEFAULT_PREFS)
    store.set('emberkin.prefs', 'null')
    assert.deepEqual(readPrefs(), DEFAULT_PREFS)
  })

  it('survives storage that throws — a Safari private window must not take the app down', () => {
    removeStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      assert.deepEqual(readPrefs(), DEFAULT_PREFS)
      // And writing must not throw either; it falls back to memory.
      writePrefs({ reduceMotion: 'on', roomyHud: false, sound: true })
      assert.equal(readPrefs().reduceMotion, 'on')
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })

  it('stores under a namespaced key, so it cannot collide with the shared token keys', () => {
    writePrefs(DEFAULT_PREFS)
    assert.ok(store.has('emberkin.prefs'))
    assert.ok(!store.has('cf.accessToken'))
  })
})

describe('systemPrefersReducedMotion', () => {
  it('is false where there is no matchMedia, rather than throwing', () => {
    assert.equal(systemPrefersReducedMotion(), false)
  })

  it('reads the media query when there is one', () => {
    const queries: string[] = []
    ;(globalThis as { window?: unknown }).window = {
      matchMedia: (q: string) => {
        queries.push(q)
        return { matches: true }
      },
    }
    try {
      assert.equal(systemPrefersReducedMotion(), true)
      assert.deepEqual(queries, ['(prefers-reduced-motion: reduce)'])
    } finally {
      delete (globalThis as { window?: unknown }).window
    }
  })

  it('reports false when the query does not match', () => {
    ;(globalThis as { window?: unknown }).window = { matchMedia: () => ({ matches: false }) }
    try {
      assert.equal(systemPrefersReducedMotion(), false)
    } finally {
      delete (globalThis as { window?: unknown }).window
    }
  })
})
