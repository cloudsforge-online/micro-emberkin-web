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
          We could not load the descriptions of the Kin you would choose between, and offering
          you three blanks would not be a choice. Reload the page, or come back shortly.
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
          Emberkin is a game about the creatures you travel with rather than the ones you order
          about. A Warden bonds with a Kin, and that bond does the work: how deep it runs
          (<strong>Resonance</strong>), which way it leans (<strong>Harmony or Ferocity</strong>),
          and the <strong>Sync</strong> the pair of you build during a fight. Between them they
          decide what your Kin can do and what it becomes.
        </p>

        <label className="ek-field">
          <span className="ek-field__label">What should we call you?</span>
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
          <legend>Pick the Kin you set out with</legend>
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
          {starters.length === 0 ? <p className="ek-muted">This build lists no starting Kin.</p> : null}
        </fieldset>

        {failure ? <Failed notice={failure} title="That did not get going" /> : null}

        <button
          type="button"
          className="cf-btn cf-btn--ember"
          disabled={busy || !starter || name.trim().length === 0}
          onClick={() => void begin()}
        >
          {busy ? 'Beginning…' : 'Begin'}
        </button>

        <p className="ek-note">
          Your game is kept on the server, not in this browser, so it is waiting on any machine
          you sign in from. That account is a Forge Worlds account: the same one walks into Tessera
          and Aetherholm, and what you own follows you into both.
        </p>
      </div>
    </section>
  )
}
