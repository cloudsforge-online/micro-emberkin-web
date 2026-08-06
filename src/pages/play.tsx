/**
 * Play: the over-the-shoulder battle view.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE ONE THING TO UNDERSTAND ABOUT THIS SCREEN.
 *
 * It does not resolve a battle. It builds an INTENT — an enemy and a list of turns — posts it to
 * `POST /v1/saves/me/battles` (`emberkin/src/server.ts`) with an Idempotency-Key, and animates
 * the log that comes back. The engine is on the server, it is deterministic, and the same seed
 * produces the same log; so what this page plays is a recording, not a simulation.
 *
 * The upstream client ran the engine in the browser and wrote the outcome to localStorage. That
 * meant the browser decided what happened. Nothing here can.
 *
 * A consequence worth stating: the whole battle is submitted at once, not turn by turn, because
 * the route resolves a whole battle. So the player composes their turns and then watches. The
 * screen is honest about that rather than faking an interactive round trip it cannot make.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '../lib/game.tsx'
import { Failed, Loading } from '../components/states.tsx'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import { newIdempotencyKey, submitBattle, type BattleResult, type KinSpec } from '../lib/emberkin.ts'
import { loadSave, battleDelta, type BattleDelta } from '../lib/save.ts'
import { beatsFrom, currentRegion, outcomeLabel, rollEncounter, toScript, wildEnemy, type Intent } from '../lib/battle.ts'
import { resonanceChange } from '../lib/resonance.ts'
import { readPrefs, shouldReduceMotion, systemPrefersReducedMotion } from '../lib/prefs.ts'
import { biomeKeyart } from '../lib/art.ts'
import { effectivenessAgainst, effectivenessLabel } from '../lib/types.ts'
import { itemName, isResonator } from '../lib/items.ts'
import { SpeciesPortrait, TypeChips } from '../components/kin.tsx'
import { ResonanceChangeNote } from '../components/bond.tsx'
import { StarterChoice } from '../components/starter.tsx'
import type { BattleStage } from '../game/stage.ts'
// From its own module, so asking the question does not statically import the renderer.
import { webglAvailable } from '../game/webgl.ts'

/** The turn limit submitted with a battle. `emberkin/src/server.ts`; the server's own default is 100. */
const MAX_TURNS = 24

export function PlayPage() {
  const { save, content, reloadSave, setSave } = useGame()

  if (save.status === 'loading' || content.status === 'loading') return <Loading label="Waking the world" />
  if (save.status === 'failed') {
    return <Failed notice={save.notice} title="Your save could not be read" onRetry={() => void reloadSave()} />
  }
  if (save.status === 'absent') return <StarterChoice />

  return <BattleView key={save.save.currentRegion} onSaved={setSave} />
}

function BattleView({ onSaved }: { onSaved: (m: Awaited<ReturnType<typeof loadSave>>) => void }) {
  const { save, content } = useGame()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<BattleStage | null>(null)

  const [encounter, setEncounter] = useState<KinSpec | null>(null)
  const [intents, setIntents] = useState<Intent[]>([])
  const [result, setResult] = useState<BattleResult | null>(null)
  const [delta, setDelta] = useState<BattleDelta | null>(null)
  const [shown, setShown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ErrorNotice | null>(null)
  const [renderable, setRenderable] = useState<boolean | null>(null)

  const state = save.status === 'present' ? save.save : null
  const data = content.data
  const region = state && data ? currentRegion(data, state.currentRegion) : null
  const lead = state?.party[0] ?? null
  const leadSpecies = lead && data ? (data.speciesById.get(lead.speciesId) ?? null) : null

  const reduced = useMemo(() => shouldReduceMotion(readPrefs(), systemPrefersReducedMotion()), [])

  /* ---- the encounter ---- */
  useEffect(() => {
    if (!region) return
    setEncounter(rollEncounter(region))
  }, [region])

  /* ---- the stage ---- */
  useEffect(() => {
    // Probed before the dynamic import, so a machine that cannot render never downloads a
    // renderer. The battle then plays as its log, which is complete.
    const ok = webglAvailable()
    setRenderable(ok)
    if (!ok) return
    const canvas = canvasRef.current
    if (!canvas || !region || !encounter || !data || !leadSpecies) return

    const enemySpecies = data.speciesById.get(encounter.species) ?? null
    if (!enemySpecies) return

    let cancelled = false
    void import('../game/stage.ts')
      .then(({ mountBattleStage }) =>
        mountBattleStage({
          canvas,
          regionId: region.id,
          player: {
            speciesId: leadSpecies.id,
            species: leadSpecies,
            visual: data.visualById.get(leadSpecies.id),
          },
          enemy: {
            speciesId: enemySpecies.id,
            species: enemySpecies,
            visual: data.visualById.get(enemySpecies.id),
          },
          reducedMotion: reduced,
        }),
      )
      .then((stage) => {
        if (cancelled) {
          stage.dispose()
          return
        }
        stageRef.current = stage
      })
      .catch(() => {
        // A renderer that fails to mount is not a broken game — the log is the battle. The report
        // has already been made by obs's global handlers.
        if (!cancelled) setRenderable(false)
      })

    return () => {
      cancelled = true
      // Releasing the WebGL context matters: browsers cap them per document and evict silently,
      // so a session that mounted one per encounter would eventually render nothing.
      stageRef.current?.dispose()
      stageRef.current = null
    }
  }, [region, encounter, data, leadSpecies, reduced])

  /* ---- playing the log back ---- */
  const beats = useMemo(() => (result ? beatsFrom(result.log) : []), [result])

  useEffect(() => {
    if (!result || shown >= beats.length) return
    const beat = beats[shown]
    const cue = beat?.cue
    let wait = reduced ? 350 : 700
    if (cue && stageRef.current) {
      const seconds = stageRef.current.play(
        cue.kind === 'effective' || cue.kind === 'no-effect' ? 'hit' : cue.kind,
      )
      wait = Math.max(reduced ? 350 : 400, seconds * 1000)
    }
    const timer = setTimeout(() => setShown((n) => n + 1), wait)
    return () => clearTimeout(timer)
  }, [result, shown, beats, reduced])

  const submit = useCallback(async () => {
    if (!encounter || !state) return
    setBusy(true)
    setFailure(null)
    setResult(null)
    setDelta(null)
    setShown(0)
    const before = state
    try {
      // A FRESH key per submission. The key expresses "this attack, once": a network retry of THIS
      // call replays the recorded battle (`emberkin/src/battles.ts`), while a second,
      // identical attack a minute later is a second battle and gets its own key. Deriving the key
      // from the body would silently merge the two, and the player would watch the second attack
      // do nothing at all.
      const key = newIdempotencyKey()
      const outcome = await submitBattle(key, {
        enemy: wildEnemy(encounter),
        script: toScript(intents.length > 0 ? intents : [{ kind: 'move', moveId: lead?.moves[0] ?? '' }]),
        maxTurns: MAX_TURNS,
      })
      setResult(outcome)

      // The party is re-read from the SERVICE rather than patched locally. The battle route
      // rewrites party, box and dexSeen (`emberkin/src/battles.ts`) and the response
      // carries none of them — only the log. A client that guessed at the new party would be
      // showing numbers the server never agreed to.
      const machine = await loadSave()
      onSaved(machine)
      if (machine.status === 'present') setDelta(battleDelta(before, machine.save))
    } catch (err) {
      setFailure(noticeFor(err, 'The battle could not be submitted.'))
    } finally {
      setBusy(false)
    }
  }, [encounter, state, intents, lead, onSaved])

  if (!state) return <Loading label="Reading your save" />
  if (!region) {
    return (
      <section className="ek-page">
        <h1>Somewhere unmapped</h1>
        <p>
          Your save says you are in <code>{state.currentRegion}</code>, and this build has no data
          for that region. Nothing is broken; this bundle is simply older or newer than your save.
        </p>
      </section>
    )
  }

  const keyart = biomeKeyart(region.id)
  const enemySpecies = encounter && data ? (data.speciesById.get(encounter.species) ?? null) : null
  const finished = result !== null && shown >= beats.length

  return (
    <section className="ek-play">
      <div className="ek-play__stage">
        {/*
          The canvas is present even when WebGL is not, so the layout does not jump when the probe
          answers. The keyart underneath is what a reader without a GPU sees, and it is real art
          rather than a grey box.
        */}
        <img className="ek-play__keyart" src={keyart ?? ''} alt="" aria-hidden={keyart ? 'true' : undefined} />
        <canvas ref={canvasRef} className="ek-play__canvas" aria-hidden="true" />
        {renderable === false ? (
          <p className="ek-play__nogl">
            This browser cannot draw the 3D view, so the battle plays as its log below. Nothing is
            missing from the game itself — the fight is resolved on the server either way.
          </p>
        ) : null}
      </div>

      <div className="ek-play__panel">
        <header>
          <h1>{region.name}</h1>
          <p className="ek-muted">Act {region.act}</p>
        </header>

        {!lead ? (
          <p>You have no Kin able to battle. Visit your party.</p>
        ) : !encounter || !enemySpecies ? (
          <p>Nothing stirs here.</p>
        ) : (
          <>
            <div className="ek-play__enemy">
              <SpeciesPortrait speciesId={enemySpecies.id} name={enemySpecies.name} size="thumb" />
              <div>
                <h2>
                  Wild {enemySpecies.name} <span className="cf-num">Lv {encounter.level}</span>
                </h2>
                <TypeChips types={enemySpecies.types} />
              </div>
            </div>

            <TurnBuilder
              intents={intents}
              onChange={setIntents}
              moves={lead.moves}
              hasArt={Boolean(leadSpecies?.resonanceArt) && lead.resonance >= 50}
              resonance={lead.resonance}
              inventory={state.inventory}
              defenderTypes={enemySpecies.types}
            />

            <div className="ek-play__actions">
              <button type="button" className="cf-btn cf-btn--ember" disabled={busy} onClick={() => void submit()}>
                {busy ? 'Resolving…' : 'Send it'}
              </button>
              <button
                type="button"
                className="cf-btn"
                disabled={busy}
                onClick={() => {
                  setResult(null)
                  setDelta(null)
                  setIntents([])
                  setEncounter(rollEncounter(region))
                }}
              >
                Look for something else
              </button>
            </div>

            <p className="ek-note">
              The whole battle is submitted at once and resolved on the server, then played back
              here. That is not a shortcut: the engine is deterministic, so the same seed produces
              the same fight, and what you are watching is exactly what happened.
            </p>
          </>
        )}

        {failure ? <Failed notice={failure} title="That battle was not resolved" /> : null}

        {result ? (
          <div className="ek-log" role="log" aria-live="polite">
            <h2>
              {outcomeLabel(result.outcome)}
              {result.replayed ? <span className="ek-muted"> · replayed a battle already recorded</span> : null}
            </h2>
            <ol>
              {beats.slice(0, shown).map((beat, i) => (
                <li key={i}>{beat.text}</li>
              ))}
            </ol>
            {!finished ? (
              <button type="button" className="cf-btn cf-btn--quiet" onClick={() => setShown(beats.length)}>
                Skip to the end
              </button>
            ) : null}
          </div>
        ) : null}

        {finished && delta ? <Aftermath delta={delta} result={result} /> : null}
      </div>
    </section>
  )
}

/**
 * What changed, and why it mattered.
 *
 * Every number here comes from the SAVE DIFF, never from the log. The log is prose the engine
 * wrote for a reader; parsing numbers out of it is how a display drifts from the truth it claims
 * to describe. `battleDelta` compares two saves the server produced, so each figure is a fact.
 */
function Aftermath({ delta, result }: { delta: BattleDelta; result: BattleResult | null }) {
  const { content } = useGame()
  const somethingChanged =
    delta.kin.some((k) => k.resonanceAfter !== k.resonanceBefore || k.levelAfter !== k.levelBefore) ||
    delta.newlySeen.length > 0 ||
    delta.caught.length > 0 ||
    (result?.unlocked.length ?? 0) > 0

  return (
    <section className="ek-aftermath">
      <h2>What that changed</h2>
      {!somethingChanged ? (
        <p>Nothing changed — no bond deepened, nothing new was recorded.</p>
      ) : null}

      {delta.kin.map((k) => {
        const change = resonanceChange(k.resonanceBefore, k.resonanceAfter)
        const levelled = k.levelAfter > k.levelBefore
        const name = content.data?.speciesById.get(k.speciesId)?.name ?? k.name
        if (change.delta === 0 && !levelled) return null
        return (
          <div key={k.slot}>
            {levelled ? (
              <p>
                <strong>{name}</strong> reached level <span className="cf-num">{k.levelAfter}</span>.
              </p>
            ) : null}
            <ResonanceChangeNote name={name} change={change} />
          </div>
        )
      })}

      {delta.caught.length > 0 ? (
        <p>
          Caught: {delta.caught.map((id) => content.data?.speciesById.get(id)?.name ?? id).join(', ')}. They
          are resting in your box.
        </p>
      ) : null}

      {delta.newlySeen.length > 0 ? (
        <p>
          New to your dex:{' '}
          {delta.newlySeen.map((id) => content.data?.speciesById.get(id)?.name ?? id).join(', ')}.{' '}
          <Link to="/dex">Have a look.</Link>
        </p>
      ) : null}

      {result && result.unlocked.length > 0 ? (
        <div className="ek-aftermath__ach">
          <h3>Recorded on your profile</h3>
          <ul>
            {result.unlocked.map((a) => (
              <li key={a.code}>
                <strong>{a.name}</strong> — <span className="cf-num">{a.points}</span> points
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Composing the turns.
 *
 * The effectiveness readout beside each move is the type chart doing its job: it is DISPLAY only —
 * damage is computed by `emberkin/src/engine/damage.ts` — and it is a phrase, never a colour, so a
 * reader who cannot tell the tints apart reads the same thing.
 */
function TurnBuilder({
  intents,
  onChange,
  moves,
  hasArt,
  resonance,
  inventory,
  defenderTypes,
}: {
  intents: readonly Intent[]
  onChange: (next: Intent[]) => void
  moves: readonly string[]
  hasArt: boolean
  resonance: number
  inventory: Readonly<Record<string, number>>
  defenderTypes: readonly string[]
}) {
  const { content } = useGame()
  const chart = content.data?.types.chart ?? {}
  const resonators = Object.keys(inventory).filter((id) => isResonator(id) && (inventory[id] ?? 0) > 0)

  const add = (intent: Intent) => onChange([...intents, intent])

  return (
    <div className="ek-turns">
      <h2>Your turns</h2>
      <ol className="ek-turns__list">
        {intents.map((intent, i) => (
          <li key={i}>
            {describeIntent(intent, content.data?.moveById)}
            <button type="button" className="cf-btn cf-btn--quiet" onClick={() => onChange(intents.filter((_, j) => j !== i))}>
              Remove
            </button>
          </li>
        ))}
        {intents.length === 0 && (
          <li className="ek-muted">
            None chosen — the first move will be used each turn, which is what the server does with an
            empty script.
          </li>
        )}
      </ol>

      <div className="ek-turns__choices">
        {moves.map((moveId) => {
          const move = content.data?.moveById.get(moveId)
          const mult = move ? effectivenessAgainst(chart, move.type, defenderTypes) : 1
          return (
            <button key={moveId} type="button" className="ek-turns__move" onClick={() => add({ kind: 'move', moveId })}>
              <span className="ek-turns__movename">{move?.name ?? moveId}</span>
              {move ? (
                <span className="ek-turns__movemeta">
                  {move.type} · {move.category} · power {move.power > 0 ? move.power : '—'} ·{' '}
                  {effectivenessLabel(mult)}
                </span>
              ) : (
                <span className="ek-turns__movemeta ek-muted">this build has no data for this move</span>
              )}
            </button>
          )
        })}

        <button
          type="button"
          className="ek-turns__move"
          disabled={!hasArt}
          onClick={() => add({ kind: 'art' })}
          title={hasArt ? undefined : `Resonance 50 unlocks the Art. Currently ${resonance}.`}
        >
          <span className="ek-turns__movename">Resonance Art</span>
          <span className="ek-turns__movemeta">
            {hasArt ? 'Costs Sync, which builds during the battle.' : `Locked until Resonance 50 — currently ${resonance}.`}
          </span>
        </button>

        {resonators.map((id) => (
          <button key={id} type="button" className="ek-turns__move" onClick={() => add({ kind: 'catch', itemId: id })}>
            <span className="ek-turns__movename">Throw a {itemName(id)}</span>
            <span className="ek-turns__movemeta">
              You have <span className="cf-num">{inventory[id]}</span>.
            </span>
          </button>
        ))}

        <button type="button" className="ek-turns__move" onClick={() => add({ kind: 'flee' })}>
          <span className="ek-turns__movename">Flee</span>
          <span className="ek-turns__movemeta">Wild Kin only.</span>
        </button>
      </div>
    </div>
  )
}

function describeIntent(intent: Intent, moves?: ReadonlyMap<string, { name: string }>): string {
  switch (intent.kind) {
    case 'move':
      return moves?.get(intent.moveId)?.name ?? intent.moveId
    case 'art':
      return 'Resonance Art'
    case 'catch':
      return `Throw a ${itemName(intent.itemId)}`
    case 'flee':
      return 'Flee'
    case 'switch':
      return `Switch to slot ${intent.index + 1}`
    case 'item':
      return `Use ${itemName(intent.itemId)}`
  }
}
