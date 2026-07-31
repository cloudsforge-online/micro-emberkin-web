/**
 * The persistent HUD.
 *
 * Present on every screen, because this is a game and your party's condition and where you are
 * should be legible from the dex as much as from the battle. It is deliberately small: a strip of
 * six portraits with health, the region, and the lead Kin's bond. Anything more belongs on the
 * party screen, and a HUD that grows into a second party screen has stopped being a HUD.
 *
 * Every state it can be in is a different thing on screen, and none of them is a zero:
 *   no session      — an invitation to sign in, not an empty party.
 *   no save         — "you have not started", not six blank slots.
 *   save failed     — the failure and its request id, not an empty party.
 *   empty party     — six blank slots is CORRECT here, and cannot be reached by the above.
 */
import { Link } from 'react-router-dom'
import { useSession } from '../lib/auth.tsx'
import { useGame } from '../lib/game.tsx'
import { biomeKeyart } from '../lib/art.ts'
import { describeResonance } from '../lib/resonance.ts'
import { SpeciesPortrait } from './kin.tsx'
import { maxHpOf } from './kin.tsx'

export function HudStrip() {
  const { status } = useSession()
  const { save, content } = useGame()

  if (status === 'anonymous') {
    return (
      <aside className="ek-hud ek-hud--quiet" aria-label="Your party">
        <p className="ek-hud__note">Sign in to pick up your Wardens and your Kin.</p>
      </aside>
    )
  }

  if (save.status === 'loading' || status === 'loading') {
    return (
      <aside className="ek-hud ek-hud--quiet" aria-label="Your party" aria-busy="true">
        <p className="ek-hud__note">Reading your save…</p>
      </aside>
    )
  }

  if (save.status === 'failed') {
    return (
      <aside className="ek-hud ek-hud--failed" aria-label="Your party" role="status">
        <p className="ek-hud__note">
          Your save is unavailable — {save.notice.message}
          {save.notice.requestId ? (
            <>
              {' '}
              <code className="cf-num ek-reqid">{save.notice.requestId}</code>
            </>
          ) : null}
        </p>
      </aside>
    )
  }

  if (save.status === 'absent') {
    return (
      <aside className="ek-hud ek-hud--quiet" aria-label="Your party">
        <p className="ek-hud__note">
          No save yet. <Link to="/">Begin your first bond.</Link>
        </p>
      </aside>
    )
  }

  const { save: state } = save
  const region = content.data?.campaign.regions.find((r) => r.id === state.currentRegion) ?? null
  const keyart = biomeKeyart(state.currentRegion)
  const lead = state.party[0] ?? null
  const bond = lead ? describeResonance(lead.resonance) : null

  return (
    <aside
      className="ek-hud"
      aria-label="Your party"
      // The region keyart as a dimmed backdrop. `background-image` rather than an <img>, because
      // it is decoration and carries nothing an assistive technology should announce; the region's
      // NAME is right there in text.
      style={keyart ? { backgroundImage: `url(${keyart})` } : undefined}
    >
      <div className="ek-hud__where">
        <span className="ek-hud__warden">{state.wardenName}</span>
        <span className="ek-hud__region">{region?.name ?? state.currentRegion}</span>
      </div>

      <ul className="ek-hud__party">
        {state.party.map((kin, index) => {
          const species = content.data?.speciesById.get(kin.speciesId) ?? null
          const name = kin.nickname ?? species?.name ?? kin.speciesId
          const max = species ? maxHpOf(species.baseStats.hp, kin) : null
          const fraction = max ? Math.max(0, Math.min(1, kin.currentHp / max)) : null
          const fainted = kin.currentHp <= 0
          return (
            <li key={`${kin.speciesId}-${index}`} className={`ek-hud__slot${fainted ? ' is-fainted' : ''}`}>
              <SpeciesPortrait speciesId={kin.speciesId} name={name} size="thumb" className="ek-hud__portrait" />
              <span className="ek-hud__name">{name}</span>
              <span className="ek-hud__level cf-num">Lv {kin.level}</span>
              {/*
                Fainted is stated in words as well as by the dimming, and the health readout falls
                back to the raw number when the maximum is unknowable. Never a bar with no number.
              */}
              {fainted ? (
                <span className="ek-hud__fainted">Fainted</span>
              ) : fraction === null ? (
                <span className="ek-hud__hp cf-num">{kin.currentHp} HP</span>
              ) : (
                <span
                  className="ek-hud__hp"
                  role="meter"
                  aria-valuenow={kin.currentHp}
                  aria-valuemin={0}
                  aria-valuemax={max ?? 0}
                  aria-valuetext={`${name}, ${kin.currentHp} of ${max} HP`}
                >
                  <span
                    className={`ek-hud__hpfill${fraction <= 0.2 ? ' is-critical' : fraction <= 0.5 ? ' is-low' : ''}`}
                    style={{ inlineSize: `${fraction * 100}%` }}
                  />
                </span>
              )}
            </li>
          )
        })}
        {state.party.length === 0 && <li className="ek-hud__slot ek-hud__slot--empty">No Kin with you</li>}
      </ul>

      {bond && lead ? (
        <div className="ek-hud__bond">
          <span className="ek-hud__bondlabel">Lead bond</span>
          <span className="ek-hud__bondband">{bond.band.name}</span>
          <span className="ek-hud__bondvalue cf-num">{bond.value}</span>
        </div>
      ) : null}
    </aside>
  )
}
