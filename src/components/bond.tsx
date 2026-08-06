/**
 * Resonance, Temperament and Sync, drawn.
 *
 * These three are the game's identity (19 §1.2), so they get real components rather than three
 * anonymous progress bars. The rules they follow:
 *
 *   A meter is `role="meter"` with `aria-valuenow/min/max` and a `aria-valuetext` that says the
 *   BAND, not just the number — "62 of 100, Resonant" is what a screen reader user needs, and
 *   "62%" is not.
 *
 *   No meter is colour alone. Each carries its glyph (from the generated UI chrome) and its
 *   written band name. Emberkin's own palette is art direction and several of its hues are
 *   inseparable; see the header of `lib/types.ts`.
 *
 *   Sync, which is not in a save, renders a SENTENCE and not a bar. `describeSync` returns
 *   `known: false` and the component honours it. A bar at zero would be a claim, and false.
 */
import { chrome } from '../lib/art.ts'
import {
  describeResonance,
  describeSync,
  describeTemperament,
  RESONANCE_MAX,
  RESONANCE_MIN,
  TEMPERAMENT_MAX,
  TEMPERAMENT_MIN,
  type ResonanceChange,
} from '../lib/resonance.ts'

/** The generated glyphs, by manifest slug. `public/art/ui/glyph-*.png`. */
const GLYPH = {
  resonance: chrome('glyph-resonance'),
  sync: chrome('glyph-sync'),
  harmony: chrome('glyph-temperament-harmony'),
  ferocity: chrome('glyph-temperament-ferocity'),
} as const

function Glyph({ src, label }: { src: string | null; label: string }) {
  // A missing glyph renders nothing rather than a broken image; the label beside it always
  // carries the meaning, which is the point of never using an image alone.
  if (!src) return null
  return <img className="ek-glyph" src={src} alt="" aria-hidden="true" width={20} height={20} title={label} />
}

export function ResonanceMeter({ value, compact = false }: { value: number; compact?: boolean }) {
  const d = describeResonance(value)
  return (
    <div className={`ek-meter ek-meter--resonance${compact ? ' is-compact' : ''}`}>
      <div className="ek-meter__head">
        <Glyph src={GLYPH.resonance} label="Resonance" />
        <span className="ek-meter__label">Resonance</span>
        <span className="ek-meter__band">{d.band.name}</span>
        <span className="ek-meter__value cf-num">{d.value}</span>
      </div>
      <div
        className="ek-meter__track"
        role="meter"
        aria-valuenow={d.value}
        aria-valuemin={RESONANCE_MIN}
        aria-valuemax={RESONANCE_MAX}
        aria-valuetext={`${d.value} of ${RESONANCE_MAX}, ${d.band.name}`}
        aria-label="Resonance"
      >
        <span className="ek-meter__fill" style={{ inlineSize: `${d.fraction * 100}%` }} />
        {/* The band boundaries as ticks, so a player can see how far the next milestone is. */}
        <span className="ek-meter__tick" style={{ insetInlineStart: '25%' }} aria-hidden="true" />
        <span className="ek-meter__tick" style={{ insetInlineStart: '50%' }} aria-hidden="true" />
      </div>
      {!compact && (
        <p className="ek-meter__note">
          {d.band.effect}
          {d.next && d.toNext !== null ? ` ${d.toNext} more to ${d.next.name}.` : ''}
        </p>
      )}
    </div>
  )
}

export function TemperamentMeter({ value, compact = false }: { value: number; compact?: boolean }) {
  const d = describeTemperament(value)
  return (
    <div className={`ek-meter ek-meter--temperament${compact ? ' is-compact' : ''}`}>
      <div className="ek-meter__head">
        <Glyph src={d.lean === 'harmony' ? GLYPH.harmony : GLYPH.ferocity} label={d.label} />
        <span className="ek-meter__label">Temperament</span>
        <span className="ek-meter__band">{d.label}</span>
        <span className="ek-meter__value cf-num">{d.value > 0 ? `+${d.value}` : d.value}</span>
      </div>
      {/*
        A two-ended meter: the midpoint is the SCALE's zero and the fill grows from it. Note that
        zero itself reads as Ferocity, which is the engine's rule (`kin.ts`) and not a rounding
        choice — see describeTemperament.
      */}
      <div
        className="ek-meter__track ek-meter__track--bipolar"
        role="meter"
        aria-valuenow={d.value}
        aria-valuemin={TEMPERAMENT_MIN}
        aria-valuemax={TEMPERAMENT_MAX}
        aria-valuetext={`${d.value}, leaning ${d.label}`}
        aria-label="Temperament"
      >
        <span className="ek-meter__midpoint" aria-hidden="true" />
        <span
          className={`ek-meter__fill ek-meter__fill--${d.lean}`}
          style={{
            insetInlineStart: d.lean === 'ferocity' ? '50%' : `${50 - d.intensity * 50}%`,
            inlineSize: `${d.intensity * 50}%`,
          }}
        />
      </div>
      {!compact && (
        <p className="ek-meter__note">
          Harmony ↔ Ferocity. It steers which moves land hardest and which evolution a Kin reaches.
        </p>
      )}
    </div>
  )
}

/**
 * Sync — a sentence, not a bar, outside a battle.
 *
 * `value` is accepted because a battle screen COULD have one if a future route returned it. Today
 * nothing does, so the sentence is what renders, and rule 4 is satisfied by construction rather
 * than by remembering.
 */
export function SyncReadout({ value }: { value?: number | null }) {
  const d = describeSync(value)
  return (
    <div className="ek-meter ek-meter--sync">
      <div className="ek-meter__head">
        <Glyph src={GLYPH.sync} label="Sync" />
        <span className="ek-meter__label">Sync</span>
        {d.known ? (
          <span className="ek-meter__value cf-num">{d.value}</span>
        ) : (
          <span className="ek-meter__band ek-meter__band--unknown">not known here</span>
        )}
      </div>
      {d.known ? (
        <div
          className="ek-meter__track"
          role="meter"
          aria-valuenow={d.value ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Sync"
        >
          <span className="ek-meter__fill" style={{ inlineSize: `${(d.value ?? 0)}%` }} />
        </div>
      ) : null}
      <p className="ek-meter__note">{d.note}</p>
    </div>
  )
}

/**
 * What a battle changed, and why it mattered.
 *
 * This is 19 §1.5.2 made visible: the bond stops being local colour when the game says what your
 * care bought. A crossed band is announced by name and by its real effect; a change that crossed
 * nothing is still shown, because a player pushing towards Attuned wants to see the four points.
 */
export function ResonanceChangeNote({ name, change }: { name: string; change: ResonanceChange }) {
  if (change.delta === 0) return null
  const up = change.delta > 0
  return (
    <div className={`ek-change${up ? ' is-up' : ' is-down'}`}>
      <p className="ek-change__line">
        <strong>{name}</strong>
        {/* The arrow is decorative; the word carries it. */}
        <span aria-hidden="true">{up ? ' ▲ ' : ' ▼ '}</span>
        <span>
          Resonance {up ? 'rose' : 'fell'} by {Math.abs(change.delta)}, to{' '}
          <span className="cf-num">{change.after}</span>
        </span>
      </p>
      {change.crossed.map((band) => (
        <p key={band.at} className="ek-change__band">
          <strong>{band.name} reached.</strong> {band.effect}
        </p>
      ))}
    </div>
  )
}
