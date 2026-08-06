/**
 * The dex: all fifty Kin, and which you have met.
 *
 * Public — `GET /v1/content/dex` takes no principal (`emberkin/src/server.ts`), so a visitor
 * who has not signed in can read the whole roster. What they cannot see is the "seen" state, which
 * comes from the save.
 *
 * The reconciliation banner is the visible half of `content.ts`: this bundle carries a rendering
 * copy of the content and the service carries the canonical one, and when they disagree the page
 * says so instead of drawing a hole.
 */
import { useMemo, useState } from 'react'
import { useGame } from '../lib/game.tsx'
import { Failed, Loading } from '../components/states.tsx'
import { SpeciesPortrait, TypeChips } from '../components/kin.tsx'
import { ELEMENTS, elementName, typeChip } from '../lib/types.ts'
import { displayName } from '../lib/content.ts'

export function DexPage() {
  const { content, dex, save, reconciliation } = useGame()
  const [filter, setFilter] = useState<string>('')
  const [query, setQuery] = useState('')

  const seen = useMemo(
    () => new Set(save.status === 'present' ? save.save.dexSeen : []),
    [save],
  )

  if (dex.status === 'loading') return <Loading label="Reading the roster" />
  if (dex.status === 'failed' && dex.error) {
    return <Failed notice={dex.error} title="The roster could not be read" />
  }

  const entries = (dex.data ?? []).filter((entry) => {
    const local = content.data?.speciesById.get(entry.id)
    const types = local?.types ?? entry.types
    if (filter && !types.includes(filter)) return false
    if (query) {
      const q = query.toLowerCase()
      if (!entry.name.toLowerCase().includes(q) && !entry.id.includes(q)) return false
    }
    return true
  })

  return (
    <section className="ek-page">
      <header className="ek-page__head">
        <h1>Dex</h1>
        <p className="ek-page__lede">
          {/*
            The counts are facts and are separated: how many the SERVICE knows, and how many this
            account has met. A single "12/50" would hide which number came from where.
          */}
          The service knows <span className="cf-num">{dex.data?.length ?? 0}</span> Kin.
          {save.status === 'present' ? (
            <>
              {' '}
              You have met <span className="cf-num">{seen.size}</span>.
            </>
          ) : save.status === 'absent' ? (
            ' Sign in and begin to start recording what you meet.'
          ) : null}
        </p>
      </header>

      {reconciliation && !reconciliation.agreed ? <ReconciliationNote /> : null}

      <div className="ek-filters">
        <label className="ek-field">
          <span className="ek-field__label">Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="name or id"
            className="cf-input"
          />
        </label>

        {/*
          Type filters are BUTTONS with names, not coloured squares. The nine element hues are art
          direction and several pairs are inseparable — see lib/types.ts. The icon is decoration
          beside the word, and `aria-pressed` carries the state rather than the fill.
        */}
        <div className="ek-typefilter" role="group" aria-label="Filter by type">
          <button
            type="button"
            className={`ek-typefilter__btn${filter === '' ? ' is-on' : ''}`}
            aria-pressed={filter === ''}
            onClick={() => setFilter('')}
          >
            All
          </button>
          {ELEMENTS.map((element) => {
            const chip = typeChip(element)
            return (
              <button
                key={element}
                type="button"
                className={`ek-typefilter__btn${filter === element ? ' is-on' : ''}`}
                aria-pressed={filter === element}
                onClick={() => setFilter(filter === element ? '' : element)}
                style={chip.tint ? ({ ['--ek-type-tint' as string]: chip.tint } as React.CSSProperties) : undefined}
              >
                {chip.icon ? <img src={chip.icon} alt="" aria-hidden="true" width={16} height={16} /> : null}
                {elementName(element)}
              </button>
            )
          })}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="ek-empty">No Kin match that.</p>
      ) : (
        <ul className="ek-dex">
          {entries.map((entry) => {
            const local = content.data?.speciesById.get(entry.id) ?? null
            const name = displayName(entry.id, content.data, dex.data)
            const met = seen.has(entry.id)
            return (
              <li key={entry.id} className={`ek-dex__card${met ? ' is-met' : ''}`}>
                <SpeciesPortrait speciesId={entry.id} name={name} size="thumb" />
                <p className="ek-dex__num cf-num">#{String(entry.dexNumber).padStart(3, '0')}</p>
                <h2 className="ek-dex__name">{name}</h2>
                {/* The SERVICE's types, because damage is computed against them. */}
                <TypeChips types={entry.types} />
                {local ? (
                  <p className="ek-dex__cat">{local.category}</p>
                ) : (
                  <p className="ek-dex__cat ek-muted">not in this build — only its name and types are known here</p>
                )}
                <p className={`ek-dex__met${met ? '' : ' ek-muted'}`}>{met ? 'Met' : 'Not yet met'}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * What the two content copies disagree about, said plainly.
 *
 * Rendered as a `<details>` so it does not shout: none of these is an outage, and most players
 * will never open it. But a `typeDisagreement` in particular has to be reachable — a player told
 * "super effective" by a stale local chart is being lied to about the fight they are in.
 */
function ReconciliationNote() {
  const { reconciliation } = useGame()
  if (!reconciliation || reconciliation.agreed) return null
  const r = reconciliation
  return (
    <details className="ek-reconcile">
      <summary>This build and the service do not describe the same roster</summary>
      <ul>
        {r.missingLocally.length > 0 && (
          <li>
            <strong>{r.missingLocally.length}</strong> Kin the service knows are not in this build:{' '}
            {r.missingLocally.map((m) => m.name).join(', ')}. Only their name, number and types are shown.
          </li>
        )}
        {r.missingArt.length > 0 && (
          <li>
            <strong>{r.missingArt.length}</strong> have no artwork here: {r.missingArt.join(', ')}.
          </li>
        )}
        {r.stale.length > 0 && (
          <li>
            <strong>{r.stale.length}</strong> in this build are no longer in the service and are not offered:{' '}
            {r.stale.join(', ')}.
          </li>
        )}
        {r.typeDisagreement.length > 0 && (
          <li>
            <strong>{r.typeDisagreement.length}</strong> disagree about types. The service's types are shown,
            because damage is computed against them:{' '}
            {r.typeDisagreement
              .map((d) => `${d.id} (here ${d.local.join('/')}, service ${d.service.join('/')})`)
              .join('; ')}
            .
          </li>
        )}
      </ul>
    </details>
  )
}
