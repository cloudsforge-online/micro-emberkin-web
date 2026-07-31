/**
 * Player preferences: motion, contrast, and audio.
 *
 * These are the ONLY thing this app stores locally, and the exception is principled: they are
 * facts about the DEVICE, not about the game. A save is server-authoritative because two devices
 * must agree about a party; a motion preference is per-device by nature, and putting it on the
 * server would make a phone inherit a desktop's tolerance for a shaking camera.
 *
 * `reduce motion` DEFAULTS TO THE OS. `prefers-reduced-motion: reduce` is a stated accessibility
 * need and an app that ignores it until asked twice has ignored it. The stored value is a
 * three-state — `system | on | off` — so that "I have not chosen" stays distinguishable from
 * "I chose off", and a user who later turns the OS setting on is not stuck with an old explicit
 * choice they made before they needed it.
 */

export type Tri = 'system' | 'on' | 'off'

export interface Prefs {
  readonly reduceMotion: Tri
  /** Extra separation between HUD elements, for readers who need the space. */
  readonly roomyHud: boolean
  readonly sound: boolean
}

export const DEFAULT_PREFS: Prefs = { reduceMotion: 'system', roomyHud: false, sound: true }

const KEY = 'emberkin.prefs'

/**
 * Storage with a memory fallback — `localStorage` THROWS in a Safari private window rather than
 * returning null, and a preferences module that took the app down at import time in a private
 * window would be a poor trade for remembering a checkbox.
 */
const memory = new Map<string, string>()

function store(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem(KEY)
      return localStorage
    }
  } catch {
    // fall through
  }
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
  }
}

/**
 * Read the stored preferences, field by field.
 *
 * Deliberately not `{...DEFAULT, ...JSON.parse(raw)}`: that spreads whatever is in storage,
 * including a `reduceMotion: "yes"` written by a future version or by a user editing devtools, and
 * the app would then compare it against 'on' forever and quietly do nothing. Each field is
 * validated to its own domain and falls back to the default when it is not recognised.
 */
export function readPrefs(): Prefs {
  const raw = store().getItem(KEY)
  if (!raw) return DEFAULT_PREFS
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS
    const p = parsed as Record<string, unknown>
    return {
      reduceMotion: isTri(p['reduceMotion']) ? p['reduceMotion'] : DEFAULT_PREFS.reduceMotion,
      roomyHud: typeof p['roomyHud'] === 'boolean' ? p['roomyHud'] : DEFAULT_PREFS.roomyHud,
      sound: typeof p['sound'] === 'boolean' ? p['sound'] : DEFAULT_PREFS.sound,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function writePrefs(prefs: Prefs): void {
  try {
    store().setItem(KEY, JSON.stringify(prefs))
  } catch {
    // A full or blocked storage is not a reason to fail a settings screen.
  }
}

function isTri(value: unknown): value is Tri {
  return value === 'system' || value === 'on' || value === 'off'
}

/**
 * Should motion be reduced, right now?
 *
 * `systemPrefersReduced` is a parameter rather than a `matchMedia` call so this is a pure function
 * a test can drive through all six combinations. The truth table is the whole point:
 *
 *   system + OS reduce  → true    the OS asked; honour it.
 *   system + OS no      → false
 *   on     + either     → true    an explicit choice beats the OS in the accessible direction.
 *   off    + OS reduce  → TRUE.
 *
 * That last row is the one worth arguing about, and it is deliberate. "Off" here means "I did not
 * ask for reduced motion", not "override my operating system's accessibility setting" — a user who
 * has told their OS that motion makes them ill has said something this app is not entitled to
 * overrule from a checkbox they may have ticked before they knew what it did.
 */
export function shouldReduceMotion(prefs: Prefs, systemPrefersReduced: boolean): boolean {
  if (prefs.reduceMotion === 'on') return true
  return systemPrefersReduced
}

/** The live OS preference, or false where there is no `matchMedia` (tests, older engines). */
export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
