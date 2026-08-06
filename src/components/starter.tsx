/**
 * The first screen: naming yourself, and choosing the Kin you begin with.
 *
 * This is the only place `POST /v1/saves` (`emberkin/src/server.ts`) is called, and the route
 * is IDEMPOTENT — it answers 200 with the existing save rather than overwriting one
 * (`server.ts`). So this screen cannot destroy a game, and it does not need a confirmation
 * dialogue pretending it might.
 *
 * The starters come from `campaign.json`'s own `starters` array, so the three offered are the
 * three the service will accept.
 */
import { useState } from 'react'
import { useGame } from '../lib/game.tsx'
import { Failed } from '../components/states.tsx'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import { beginGame } from '../lib/save.ts'
import { SpeciesPortrait, TypeChips } from './kin.tsx'
import { titleArt } from '../lib/art.ts'

export function StarterChoice() {
  const { content, save, setSave } = useGame()
  const [name, setName] = useState('')
  const [starter, setStarter] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ErrorNotice | null>(null)

  const hero = titleArt('hero')
  const data = content.data
  const starters = data?.campaign.starters ?? []

  async function begin() {
    if (!starter || name.trim().length === 0) return
    setBusy(true)
    setFailure(null)
    try {
      const { machine } = await beginGame(save, { wardenName: name.trim(), starter })
      setSave(machine)
      if (machine.status === 'failed') setFailure(machine.notice)
    } catch (err) {
      setFailure(noticeFor(err, 'Your game could not be started.'))
    } finally {
      setBusy(false)
    }
  }

  if (content.status === 'failed') {
    return (
      <section className="ek-page">
        <h1>Emberkin</h1>
        <p>
          The starter Kin are described by content this build could not load, so there is nothing
          honest to offer you to choose between. Reload, or try again shortly.
        </p>
      </section>
    )
  }

  return (
    <section className="ek-start">
      {hero ? <img className="ek-start__hero" src={hero} alt="" aria-hidden="true" /> : null}

      <div className="ek-start__panel">
        <h1>Begin</h1>
        <p className="ek-start__lede">
          A Warden does not command a Kin; they bond with one. What that bond becomes —{' '}
          <strong>Resonance</strong>, its lean towards <strong>Harmony or Ferocity</strong>, the{' '}
          <strong>Sync</strong> you build in a fight — decides what your Kin can do and what it grows
          into.
        </p>

        <label className="ek-field">
          <span className="ek-field__label">What are you called?</span>
          <input
            className="cf-input"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Warden's name"
            autoComplete="off"
          />
        </label>

        <fieldset className="ek-start__starters">
          <legend>Choose the Kin you begin with</legend>
          {starters.map((id) => {
            const species = data?.speciesById.get(id) ?? null
            const chosen = starter === id
            return (
              <label key={id} className={`ek-start__starter${chosen ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="starter"
                  value={id}
                  checked={chosen}
                  onChange={() => setStarter(id)}
                />
                <SpeciesPortrait speciesId={id} name={species?.name ?? id} size="portrait" />
                <span className="ek-start__name">{species?.name ?? id}</span>
                <TypeChips types={species?.types ?? []} />
                <span className="ek-start__lore">{species?.lore ?? ''}</span>
                {/*
                  Base stats are shown because a starter choice with no information is a coin toss
                  dressed as a decision. They are the SPECIES' numbers, from content, and every Kin
                  of that species starts there — nothing purchasable moves them.
                */}
                {species ? (
                  <span className="ek-start__stats cf-num">
                    HP {species.baseStats.hp} · ATK {species.baseStats.attack} · DEF{' '}
                    {species.baseStats.defense} · SPD {species.baseStats.speed}
                  </span>
                ) : null}
              </label>
            )
          })}
          {starters.length === 0 ? <p className="ek-muted">No starters are listed in this build.</p> : null}
        </fieldset>

        {failure ? <Failed notice={failure} title="That did not start" /> : null}

        <button
          type="button"
          className="cf-btn cf-btn--ember"
          disabled={busy || !starter || name.trim().length === 0}
          onClick={() => void begin()}
        >
          {busy ? 'Beginning…' : 'Begin'}
        </button>

        <p className="ek-note">
          Your save lives on the server, not in this browser. Sign in anywhere and it is the same
          game.
        </p>
      </div>
    </section>
  )
}
