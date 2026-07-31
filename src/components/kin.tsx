/**
 * Drawing a Kin: its portrait, its types, its condition.
 *
 * One component per fact, so that a screen showing half of a Kin cannot accidentally imply the
 * other half. Every one of them handles "we do not have this" as its own state rather than as a
 * zero.
 */
import { speciesArt, type SpeciesArtSize } from '../lib/art.ts'
import { typeChip } from '../lib/types.ts'
import type { KinSave } from '../lib/emberkin.ts'
import type { Content } from '../lib/content.ts'
// `emberkin/src/engine/kin.ts:143-146`, kept in one place rather than restated here.
import { statMultiplier as resonanceStatMultiplier } from '../lib/resonance.ts'

/**
 * A type, as icon + name + tint.
 *
 * There is no prop that turns the label off. See `lib/types.ts`: the nine element hues are art
 * direction, several pairs are inseparable, and the estate's rule is that colour is never the only
 * channel. A chip with the label suppressed would be a swatch, and a swatch is the thing this
 * component exists to prevent.
 */
export function TypeChip({ element }: { element: string }) {
  const chip = typeChip(element)
  return (
    <span
      className="ek-type"
      // The tint is on a custom property rather than on `color`, so it can only reach the border
      // and the glow in the stylesheet — never the text, whose contrast is fixed against the ash.
      style={chip.tint ? ({ ['--ek-type-tint' as string]: chip.tint } as React.CSSProperties) : undefined}
    >
      {chip.icon ? (
        <img className="ek-type__icon" src={chip.icon} alt="" aria-hidden="true" width={18} height={18} />
      ) : null}
      <span className="ek-type__label">{chip.label}</span>
    </span>
  )
}

export function TypeChips({ types }: { types: readonly string[] }) {
  if (types.length === 0) return <span className="ek-muted">type unknown</span>
  return (
    <span className="ek-types">
      {types.map((t) => (
        <TypeChip key={t} element={t} />
      ))}
    </span>
  )
}

/**
 * A species portrait.
 *
 * `size` is required, and the caller picks it deliberately: `thumb` is 41 KB and `portrait` is
 * 584 KB. A dex grid of fifty portraits would be 29 MB of images to draw a page of thumbnails.
 * `loading="lazy"` on top of that, so a long grid fetches what is on screen.
 *
 * A species with no art renders its INITIAL and its name, not a placeholder image. A placeholder
 * looks like art and hides the gap; `test/art.test.ts` asserts the gap cannot exist for any
 * species this build knows, so seeing one means the service knows a species this bundle predates —
 * which is worth showing rather than papering over.
 */
export function SpeciesPortrait({
  speciesId,
  name,
  size,
  className,
}: {
  speciesId: string
  name: string
  size: SpeciesArtSize
  className?: string
}) {
  const src = speciesArt(speciesId, size)
  const px = size === 'thumb' ? 128 : 512
  if (!src) {
    return (
      <div className={`ek-portrait ek-portrait--absent ${className ?? ''}`} role="img" aria-label={`${name}, no artwork in this build`}>
        <span aria-hidden="true">{name.slice(0, 1)}</span>
        <span className="ek-portrait__note">no artwork in this build</span>
      </div>
    )
  }
  return (
    <img
      className={`ek-portrait ${className ?? ''}`}
      src={src}
      alt={name}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
    />
  )
}

/**
 * A Kin's health.
 *
 * The save carries `currentHp` but not `maxHp` (`emberkin/src/engine/saves.ts:9-22`). Max is
 * DERIVED — and derivable exactly, because every input to the derivation is on the wire:
 * `attunement`, `level` and `resonance` come from the save, and `baseStats.hp` from the local
 * content copy. See `maxHpOf` below.
 *
 * When the local content copy does not have the species, the base stat is missing and there is no
 * honest maximum. The raw number is then shown alone: "34 HP" is true; "34/?" drawn as a half-full
 * bar is not.
 */
export function HealthReadout({ kin, content }: { kin: KinSave; content: Content | null }) {
  const species = content?.speciesById.get(kin.speciesId) ?? null
  const max = species ? maxHpOf(species.baseStats.hp, kin) : null

  if (max === null) {
    return (
      <p className="ek-hp">
        <span className="cf-num">{kin.currentHp}</span> HP
        <span className="ek-muted"> — this build has no data for {kin.speciesId}, so it cannot say the maximum</span>
      </p>
    )
  }

  const fraction = Math.max(0, Math.min(1, kin.currentHp / max))
  return (
    <div className="ek-hp">
      <div
        className="ek-hp__track"
        role="meter"
        aria-valuenow={kin.currentHp}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={`${kin.currentHp} of ${max} HP`}
        aria-label="Health"
      >
        {/*
          Three bands, and the class is not the only signal: the text below always states both
          numbers, so a reader who cannot distinguish the fill colour reads the same fact.
        */}
        <span
          className={`ek-hp__fill${fraction <= 0.2 ? ' is-critical' : fraction <= 0.5 ? ' is-low' : ''}`}
          style={{ inlineSize: `${fraction * 100}%` }}
        />
      </div>
      <p className="ek-hp__text">
        <span className="cf-num">{kin.currentHp}</span> / <span className="cf-num">{max}</span> HP
        {kin.status && kin.status !== 'None' ? <span className="ek-status"> · {kin.status}</span> : null}
      </p>
    </div>
  )
}

/**
 * A Kin's maximum HP — the engine's arithmetic, reproduced exactly.
 *
 * `emberkin/src/engine/kin.ts:148-153`:
 *
 *     const b = this.species.baseStats.hp;
 *     const iv = this.attunement.hp;
 *     const raw = Math.trunc(((2 * b + iv) * this.level) / 100) + this.level + 10;
 *     return Math.trunc(raw * this.resonanceStatMultiplier);
 *
 * Every input is available to this client: `b` from the local content copy, and `iv`, `level` and
 * `resonance` from the save (`engine/saves.ts:9-22`, which persists `attunement`). So this is not
 * an estimate and is not labelled as one.
 *
 * THE TRUNCATION ORDER IS THE WHOLE THING. Two truncations, in that order: the level term is
 * floored BEFORE the flat `+level+10` is added, and the Resonance multiplier is applied to the
 * total and floored again. Doing it in one expression, or rounding instead of truncating, is off
 * by one across most of the level range — and a health bar that disagrees with the server by one
 * point at the bottom of the scale is the difference between "fainted" and "hanging on".
 * `test/kin.test.ts` pins it at the two multiplier boundaries and either side of them.
 */
export function maxHpOf(baseHp: number, kin: Pick<KinSave, 'level' | 'resonance' | 'attunement'>): number {
  const iv = kin.attunement['hp'] ?? 0
  const raw = Math.trunc(((2 * baseHp + iv) * kin.level) / 100) + kin.level + 10
  return Math.trunc(raw * resonanceStatMultiplier(kin.resonance))
}

