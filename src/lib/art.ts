/**
 * Finding a picture.
 *
 * The generated set from `micro-emberkin-assets` replaces what `web/tools/bake-ui.mjs` produced:
 * 50 species portraits at two sizes, 9 type icons, 6 biome keyarts, the title lockup and 12 pieces
 * of UI chrome (docs/ecosystem/19-new-products.md §1.4). This module is the only thing in the app
 * that turns a species id or a region id into a URL, so a missing picture is a missing picture in
 * one place rather than fifty broken `<img>` tags.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * TWO SIZES, AND WHICH ONE TO ASK FOR.
 *
 * `thumb` is 256×256 and averages 41 KB. `portrait` is 1024×1024 and averages 584 KB. The dex is
 * a grid of fifty; asking for portraits there would be 29 MB of images to render a page of
 * thumbnails, which is the kind of thing that makes a game client feel like a website. The grid
 * asks for `thumb`; the species detail and the battle intro ask for `portrait`, one at a time,
 * lazily. That is why `speciesArt` takes the size as an argument instead of guessing.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * WHAT IS *NOT* HERE: the 3D. FLUX produced 2D. The creature models are still the procedural glTF
 * bakes carried forward from `kindred-resonance` (`public/game/models/creatures/*.glb`), and they
 * are resolved by `src/game/` through the asset seam in `render/assets.js`, not by this file. See
 * the README's scope note; nothing in this repository implies the models were generated.
 */
import { ART, type ArtEntry } from '../art/catalogue.ts'

export type SpeciesArtSize = 'thumb' | 'portrait'

const SIZE_FOR: Readonly<Record<SpeciesArtSize, string>> = {
  thumb: '256x256',
  portrait: '1024x1024',
}

/** Indexed once at module load: fifty species times two sizes is a linear scan per render. */
const bySet = new Map<string, Map<string, ArtEntry[]>>()
for (const entry of ART) {
  let set = bySet.get(entry.set)
  if (!set) {
    set = new Map()
    bySet.set(entry.set, set)
  }
  const list = set.get(entry.slug)
  if (list) list.push(entry)
  else set.set(entry.slug, [entry])
}

function lookup(set: string, slug: string, size?: string): ArtEntry | null {
  const entries = bySet.get(set)?.get(slug)
  if (!entries || entries.length === 0) return null
  if (!size) return entries[0] ?? null
  return entries.find((e) => e.size === size) ?? null
}

/**
 * A species' picture at a size, or `null` when there is none.
 *
 * `null` rather than a placeholder path. A placeholder would render as art and hide the fact that
 * a species has none; the callers show a named gap instead, and `test/art.test.ts` asserts that
 * every species the local content data knows has both sizes — so a `null` in production means the
 * service knows a species this bundle predates, which is exactly the thing worth saying out loud.
 */
export function speciesArt(speciesId: string, size: SpeciesArtSize): string | null {
  return lookup('species', speciesId, SIZE_FOR[size])?.path ?? null
}

/** A type icon. Nine elements, `types.json`'s `elements` array. */
export function typeIcon(element: string): string | null {
  return lookup('types', element)?.path ?? null
}

/** A region's keyart. Six regions, `campaign.json`'s `regions`. */
export function biomeKeyart(regionId: string): string | null {
  return lookup('biomes', regionId)?.path ?? null
}

/** A piece of generated UI chrome, by its manifest slug (`glyph-resonance`, `frame-battle-hud`…). */
export function chrome(slug: string): string | null {
  return lookup('ui', slug)?.path ?? null
}

/** A title asset: `wordmark`, `mark`, `hero`, `capsule`, `social`, `og`. */
export function titleArt(slug: string): string | null {
  return lookup('title', slug)?.path ?? null
}

/**
 * The art accent recorded for a species or an element.
 *
 * From the manifest, which took it from `visuals.json` and `types.json` upstream — so it is the
 * colour the picture was actually generated around, not a colour this app chose to sit next to it.
 *
 * IT IS NOT A UI PALETTE. See `types.ts`: these nine hues are art direction and several pairs are
 * indistinguishable as interface colour. Use it to tint a glow behind a portrait; never to
 * distinguish one type from another.
 */
export function accentFor(set: string, slug: string): string | null {
  return lookup(set, slug)?.accent ?? null
}

/** Every species slug the art set covers. */
export function speciesWithArt(): string[] {
  return [...(bySet.get('species')?.keys() ?? [])].sort()
}

/** The whole catalogue, for the completeness test and the credits page. */
export { ART }
