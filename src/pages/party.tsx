/**
 * The party: your six, and their bonds.
 *
 * This is where Resonance, Temperament and Sync are most legible, because it is the screen a
 * player opens to ask "how is this one doing". The three are shown with their real effects
 * written next to them, not as three anonymous bars — 19 §1.5.2 asks for the bond to become
 * identity, and a bar with no caption is not identity.
 *
 * Nothing on this screen is editable. There is no route that reorders a party, renames a Kin or
 * moves one to the box — the ten routes are listed at the top of `lib/emberkin.ts` — so the page
 * does not offer controls that would fail. It says so once, rather than growing five disabled
 * buttons.
 */
import { useGame } from '../lib/game.tsx'
import { useSession } from '../lib/auth.tsx'
import { Failed, Loading } from '../components/states.tsx'
import { HealthReadout, SpeciesPortrait, TypeChips } from '../components/kin.tsx'
import { ResonanceMeter, SyncReadout, TemperamentMeter } from '../components/bond.tsx'
import { describeResonance } from '../lib/resonance.ts'
import type { KinSave } from '../lib/emberkin.ts'

export function PartyPage() {
  const { save, content, reloadSave } = useGame()
  const { status } = useSession()

  if (status === 'loading' || save.status === 'loading') return <Loading label="Reading your save" />
  if (save.status === 'failed') {
    return <Failed notice={save.notice} title="Your save could not be read" onRetry={() => void reloadSave()} />
  }
  if (save.status === 'absent') {
    return (
      <section className="ek-page">
        <h1>Party</h1>
        <p>You have not started. Begin on the Play screen and the Kin you choose turns up here.</p>
      </section>
    )
  }

  const state = save.save

  return (
    <section className="ek-page">
      <header className="ek-page__head">
        <h1>Party</h1>
        <p className="ek-page__lede">
          {state.wardenName}, with <span className="cf-num">{state.party.length}</span> Kin at hand and{' '}
          <span className="cf-num">{state.box.length}</span> resting.
        </p>
      </header>

      {state.party.length === 0 ? (
        <p className="ek-empty">Nobody is travelling with you.</p>
      ) : (
        <ul className="ek-party">
          {state.party.map((kin, index) => (
            <PartyCard key={`${kin.speciesId}-${index}`} kin={kin} slot={index} />
          ))}
        </ul>
      )}

      <p className="ek-note">
        This screen reads your game and never writes to it. Reordering your party, renaming a Kin
        and moving one to the box are not things the game lets anybody do, so you will not find
        buttons here pretending otherwise.
      </p>

      {state.box.length > 0 && (
        <>
          <h2>Resting</h2>
          <ul className="ek-box">
            {state.box.map((kin, index) => {
              const species = content.data?.speciesById.get(kin.speciesId) ?? null
              const name = kin.nickname ?? species?.name ?? kin.speciesId
              const bond = describeResonance(kin.resonance)
              return (
                <li key={`box-${kin.speciesId}-${index}`} className="ek-box__item">
                  <SpeciesPortrait speciesId={kin.speciesId} name={name} size="thumb" />
                  <span className="ek-box__name">{name}</span>
                  <span className="ek-box__level cf-num">Lv {kin.level}</span>
                  <span className="ek-box__band">{bond.band.name}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function PartyCard({ kin, slot }: { kin: KinSave; slot: number }) {
  const { content } = useGame()
  const species = content.data?.speciesById.get(kin.speciesId) ?? null
  const name = kin.nickname ?? species?.name ?? kin.speciesId
  const art = species?.resonanceArt ? content.data?.moveById.get(species.resonanceArt) : undefined
  const bond = describeResonance(kin.resonance)

  return (
    <li className="ek-party__card">
      <div className="ek-party__head">
        <SpeciesPortrait speciesId={kin.speciesId} name={name} size="portrait" className="ek-party__art" />
        <div>
          <h2>
            {name}
            {kin.nickname && species && kin.nickname !== species.name ? (
              <span className="ek-party__species"> — {species.name}</span>
            ) : null}
          </h2>
          <p className="ek-party__meta">
            Slot <span className="cf-num">{slot + 1}</span> · Level <span className="cf-num">{kin.level}</span>
            {species ? <> · {species.category}</> : null}
          </p>
          <TypeChips types={species?.types ?? []} />
          <HealthReadout kin={kin} content={content.data} />
        </div>
      </div>

      <div className="ek-party__bonds">
        <ResonanceMeter value={kin.resonance} />
        <TemperamentMeter value={kin.temperament} />
        <SyncReadout />
      </div>

      {/*
        The Art is the thing Resonance unlocks, so it is named here with its gate. `isResonant`
        is `resonance >= 50` (`emberkin/src/engine/kin.ts`), and at Perfect Resonance the
        first Art each battle is free (`kin.ts`). Both are stated rather than implied by a
        greyed-out button.
      */}
      {art ? (
        <div className={`ek-party__art-row${kin.resonance >= 50 ? ' is-unlocked' : ''}`}>
          <h3>Resonance Art — {art.name}</h3>
          <p>{art.description}</p>
          <p className="ek-party__gate">
            {kin.resonance >= 100
              ? `Costs ${art.syncCost} Sync — and the first one each battle is free at Perfect Resonance.`
              : kin.resonance >= 50
                ? `Unlocked. Costs ${art.syncCost} Sync.`
                : `Locked until Resonance 50. ${50 - bond.value} to go.`}
          </p>
        </div>
      ) : null}

      {species && species.evolutions.length > 0 ? (
        <div className="ek-party__evo">
          <h3>What it might grow into</h3>
          <ul>
            {species.evolutions.map((evo) => {
              const into = content.data?.speciesById.get(evo.into)
              return (
                <li key={evo.into}>
                  <strong>{into?.name ?? evo.into}</strong>
                  {' — '}
                  {describeRequirement(evo.requires)}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </li>
  )
}

/**
 * An evolution requirement, in words.
 *
 * The keys are `campaign`/`species.json`'s own — `level`, `resonance`, `temperamentMin`,
 * `temperamentMax`, `item` — and `emberkin/src/engine/kin.ts` is what enforces them. An
 * unrecognised key is printed as `key: value` rather than dropped: a requirement this build cannot
 * phrase is still a requirement the player has to meet, and hiding it would make an evolution look
 * impossible.
 */
export function describeRequirement(requires: Readonly<Record<string, number | string | null>>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(requires)) {
    if (value === null || value === undefined) continue
    switch (key) {
      case 'level':
        parts.push(`level ${value}`)
        break
      case 'resonance':
        parts.push(`Resonance ${value}`)
        break
      case 'temperamentMin':
        parts.push(`Temperament at or above ${value}`)
        break
      case 'temperamentMax':
        parts.push(`Temperament at or below ${value}`)
        break
      case 'item':
        parts.push(`holding ${value}`)
        break
      default:
        parts.push(`${key}: ${value}`)
    }
  }
  return parts.length > 0 ? parts.join(', ') : 'no stated requirement'
}
