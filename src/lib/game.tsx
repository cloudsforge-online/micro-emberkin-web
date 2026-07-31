/**
 * The game's shared state, and the degradation model.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * FOUR SOURCES, LOADED INDEPENDENTLY, FAILING INDEPENDENTLY.
 *
 *   content       static JSON on our own origin           /game/data/*.json
 *   save          micro-emberkin, authenticated           GET /v1/saves/me      server.ts:338
 *   dex           micro-emberkin, public                  GET /v1/content/dex   server.ts:431
 *   entitlements  micro-billing, authenticated            GET /entitlements     billing:473
 *
 * Rule 3 of the brief: degradation, not blank pages — one upstream down renders the rest and names
 * what is missing. That is only achievable if the four are separate promises with separate error
 * states, which is why this is not one `Promise.all`. A `Promise.all` would mean billing being
 * slow takes the dex down, and the player would be told the game is broken because a shop is.
 *
 * The reverse mistake is just as bad and is also guarded: a failed load must not render as an
 * EMPTY one. A wardrobe that could not reach billing shows "we could not check what you own", not
 * "you own nothing" — the second is a false statement about a purchase, and a player who bought a
 * cosmetic yesterday will read it as a theft.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { noticeFor, type ErrorNotice } from './api.ts'
import { fetchDex, type DexEntry } from './emberkin.ts'
import { fetchEntitlements, type Entitlement } from './billing.ts'
import { loadContent, reconcile, type Content, type ContentReconciliation } from './content.ts'
import { loadSave, type SaveMachine } from './save.ts'
import { useSession } from './auth.tsx'

/** One independently-loaded source. `stale` data is kept across a reload so screens do not blink. */
export interface Source<T> {
  readonly status: 'loading' | 'ready' | 'failed'
  readonly data: T | null
  readonly error: ErrorNotice | null
}

const PENDING = { status: 'loading', data: null, error: null } as const

export interface GameState {
  readonly content: Source<Content>
  readonly dex: Source<readonly DexEntry[]>
  readonly entitlements: Source<readonly Entitlement[]>
  /** When billing answered — its `at`, not ours. Empty when unknown. */
  readonly entitlementsAt: string
  readonly save: SaveMachine
  /** Where the two content copies disagree. Null until both content and dex have answered. */
  readonly reconciliation: ContentReconciliation | null
  /** Re-read the save from the service. Every mutation ends here. */
  readonly reloadSave: () => Promise<void>
  /** Adopt a save the service just returned, without a second round trip. */
  readonly setSave: (machine: SaveMachine) => void
  readonly reloadEntitlements: () => Promise<void>
  /** Everything that is currently unavailable, in words. Empty when all four answered. */
  readonly missing: readonly string[]
}

const GameContext = createContext<GameState | null>(null)

export function useGame(): GameState {
  const value = useContext(GameContext)
  if (!value) throw new Error('useGame must be used inside <GameProvider>')
  return value
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession()
  const signedIn = sessionStatus === 'signedIn'

  const [content, setContent] = useState<Source<Content>>(PENDING)
  const [dex, setDex] = useState<Source<readonly DexEntry[]>>(PENDING)
  const [entitlements, setEntitlements] = useState<Source<readonly Entitlement[]>>(PENDING)
  const [entitlementsAt, setEntitlementsAt] = useState('')
  const [save, setSave] = useState<SaveMachine>({ status: 'loading' })

  // Guards every setState against a component that unmounted mid-flight. Without it a signed-out
  // navigation during a slow save read warns in development and, worse, resurrects state in a tree
  // that is gone.
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  /* ---- content: our own origin, so it is loaded regardless of session ---- */
  useEffect(() => {
    loadContent()
      .then((value) => live.current && setContent({ status: 'ready', data: value, error: null }))
      .catch((err: unknown) => {
        if (!live.current) return
        setContent({
          status: 'failed',
          data: null,
          error: noticeFor(err, 'The game content could not be loaded from this build.'),
        })
      })
  }, [])

  /* ---- dex: public, so also loaded signed out ---- */
  useEffect(() => {
    fetchDex()
      .then((value) => live.current && setDex({ status: 'ready', data: value, error: null }))
      .catch((err: unknown) => {
        if (!live.current) return
        setDex({ status: 'failed', data: null, error: noticeFor(err, 'The species list is unavailable.') })
      })
  }, [])

  /* ---- save: needs a session ---- */
  const reloadSave = useCallback(async () => {
    if (!signedIn) {
      // Not 'failed'. A signed-out visitor has no save to fail to load, and showing them an error
      // for that would be the app blaming them for not being signed in.
      setSave({ status: 'absent' })
      return
    }
    const machine = await loadSave()
    if (live.current) setSave(machine)
  }, [signedIn])

  useEffect(() => {
    void reloadSave()
  }, [reloadSave])

  /* ---- entitlements: needs a session, and only the wardrobe needs them ---- */
  const reloadEntitlements = useCallback(async () => {
    if (!signedIn) {
      setEntitlements({ status: 'ready', data: [], error: null })
      setEntitlementsAt('')
      return
    }
    try {
      const answer = await fetchEntitlements()
      if (!live.current) return
      setEntitlements({ status: 'ready', data: answer.entitlements, error: null })
      setEntitlementsAt(answer.at)
    } catch (err) {
      if (!live.current) return
      setEntitlements({
        status: 'failed',
        data: null,
        error: noticeFor(err, 'We could not check what your account owns.'),
      })
      setEntitlementsAt('')
    }
  }, [signedIn])

  useEffect(() => {
    void reloadEntitlements()
  }, [reloadEntitlements])

  const reconciliation = useMemo(
    () => (content.data && dex.data ? reconcile(content.data, dex.data) : null),
    [content.data, dex.data],
  )

  const missing = useMemo(() => describeMissing({ content, dex, entitlements, save }), [
    content,
    dex,
    entitlements,
    save,
  ])

  const value = useMemo<GameState>(
    () => ({
      content,
      dex,
      entitlements,
      entitlementsAt,
      save,
      reconciliation,
      reloadSave,
      setSave,
      reloadEntitlements,
      missing,
    }),
    [content, dex, entitlements, entitlementsAt, save, reconciliation, reloadSave, reloadEntitlements, missing],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

/**
 * What is unavailable, named.
 *
 * Exported and pure so `test/degradation.test.ts` can drive all sixteen combinations of the four
 * sources without a DOM. The sentences name the THING the player lost, not the service that lost
 * it — "your save" rather than "micro-emberkin" — because the second is not information to
 * somebody trying to play a game, and the request id in the failure state is what an engineer
 * actually needs.
 */
export function describeMissing(sources: {
  content: Source<unknown>
  dex: Source<unknown>
  entitlements: Source<unknown>
  save: SaveMachine
}): string[] {
  const missing: string[] = []
  if (sources.content.status === 'failed') missing.push('the game content in this build')
  if (sources.dex.status === 'failed') missing.push('the species list')
  if (sources.save.status === 'failed') missing.push('your save')
  if (sources.entitlements.status === 'failed') missing.push('what your account owns')
  return missing
}
