/**
 * Regenerate `src/art/catalogue.ts` from `public/art/MANIFEST.json`.
 *
 * WHY A GENERATED FILE AND NOT AN IMPORT. `MANIFEST.json` is 776 KB, most of it the FLUX prompt of
 * every image. Importing it would put three-quarters of a megabyte of prose into the bundle to
 * answer the question "where is the picture of Cindercub". The catalogue is the answer to that
 * question and nothing else: set, slug, path, size, accent, family, stage — about 20 KB.
 *
 * The provenance is not lost. `MANIFEST.json` is SERVED at `/art/MANIFEST.json`, and the credits
 * page fetches it on demand, so the disclosure ("every image here is AI-generated…", C2PA, the
 * licence) reaches a reader who asks for it without being downloaded by one who does not.
 *
 * `test/art.test.ts` re-derives the catalogue from the manifest and asserts it matches the
 * committed file, so a stale catalogue fails CI rather than silently pointing at a picture that
 * moved.
 *
 *   node tools/sync-art.mjs            regenerate
 *   node tools/sync-art.mjs --check    exit 1 if the committed file is stale
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const MANIFEST = new URL('public/art/MANIFEST.json', root)
const OUT = new URL('src/art/catalogue.ts', root)

/** Fields kept per asset. Everything else — prompt, attempts, cost — stays in the manifest. */
export function entryFrom(asset) {
  return {
    set: asset.set,
    slug: asset.slug,
    name: asset.name,
    // Served from /art/, so the manifest's repo-relative "assets/…" prefix is swapped for the
    // public one. Doing it here rather than at every call site means one place can be wrong.
    path: `/art/${String(asset.path).replace(/^assets\//, '')}`,
    size: asset.deliveredSize ?? asset.declaredSize,
    accent: asset.accent ?? null,
    family: asset.family ?? null,
    stage: asset.stage ?? null,
  }
}

export function catalogueFrom(manifest) {
  return manifest.assets
    .map(entryFrom)
    .sort((a, b) => (a.set === b.set ? a.path.localeCompare(b.path) : a.set.localeCompare(b.set)))
}

export function render(manifest) {
  const entries = catalogueFrom(manifest)
  const lines = entries.map((e) => `  ${JSON.stringify(e)},`).join('\n')
  return `/**
 * Every generated image, and where it is served from. GENERATED — do not edit.
 *
 * Written by \`tools/sync-art.mjs\` from \`public/art/MANIFEST.json\`, which came from
 * \`micro-emberkin-assets\`. Run \`pnpm sync-art\` after copying a new asset set in;
 * \`test/art.test.ts\` fails if this file and the manifest disagree.
 *
 * The manifest's own provenance — the FLUX prompt, the model, the C2PA state, the licence and the
 * AI disclosure — is deliberately NOT copied here. It is served whole at \`/art/MANIFEST.json\`
 * and read by the credits page, so the disclosure travels with the images rather than being
 * summarised by the code that displays them.
 *
 * Generator: ${manifest.generator}
 * Assets: ${manifest.assetCount}
 * Updated: ${manifest.updatedAt}
 */

export interface ArtEntry {
  /** \`species\` | \`types\` | \`biomes\` | \`ui\` | \`title\`. */
  readonly set: string
  readonly slug: string
  readonly name: string
  /** Absolute, browser-resolvable, served by nginx from \`/art/\`. */
  readonly path: string
  /** \`<w>x<h>\` as delivered. Two entries per species: a 256 thumbnail and a 1024 portrait. */
  readonly size: string
  readonly accent: string | null
  /** The evolution family this species belongs to, from \`visuals.json\`. */
  readonly family: string | null
  /** \`base\` | \`mid\` | \`final\` | \`apex\` — how far along the family it stands. */
  readonly stage: string | null
}

export const ART: readonly ArtEntry[] = [
${lines}
]
`
}

const manifest = JSON.parse(readFileSync(fileURLToPath(MANIFEST), 'utf8'))
const rendered = render(manifest)

if (process.argv.includes('--check')) {
  const current = readFileSync(fileURLToPath(OUT), 'utf8')
  if (current !== rendered) {
    console.error('src/art/catalogue.ts is stale — run `pnpm sync-art`')
    process.exit(1)
  }
  console.log('ok: the art catalogue matches the manifest')
} else {
  writeFileSync(fileURLToPath(OUT), rendered)
  console.log(`wrote src/art/catalogue.ts — ${manifest.assetCount} assets`)
}
