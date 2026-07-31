/**
 * Asset-manifest completeness.
 *
 * The failure this file exists to prevent is a screen full of broken images after somebody moves a
 * directory, and the failure it exists to CATCH is subtler: a species the game knows and this
 * bundle has no picture for. Neither is visible in a diff.
 *
 * Three things are checked against each other:
 *
 *   `public/art/MANIFEST.json`   what `micro-emberkin-assets` says it produced.
 *   `src/art/catalogue.ts`       the generated derivative the bundle actually reads.
 *   the files on disk            what is really there.
 *
 * Plus the local content copy, so that every species, element and region the game names has art.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { ART } from '../src/art/catalogue.ts'
import { accentFor, biomeKeyart, chrome, speciesArt, speciesWithArt, titleArt, typeIcon } from '../src/lib/art.ts'
import { ELEMENTS } from '../src/lib/types.ts'
import { catalogueFrom, render } from '../tools/sync-art.mjs'

const root = new URL('../', import.meta.url)
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, root)), 'utf8')

interface ManifestAsset {
  set: string
  slug: string
  path: string
  deliveredSize?: string
  declaredSize?: string
}
const manifest = JSON.parse(read('public/art/MANIFEST.json')) as {
  assetCount: number
  disclosure: string
  licence: string
  assets: ManifestAsset[]
}

const species = JSON.parse(read('public/game/data/species.json')) as { id: string; name: string }[]
const campaign = JSON.parse(read('public/game/data/campaign.json')) as { regions: { id: string }[] }

describe('the manifest', () => {
  it('is not empty, so nothing below can pass for the wrong reason', () => {
    assert.ok(manifest.assets.length > 100, `only ${manifest.assets.length} assets in the manifest`)
  })

  it('agrees with its own declared count', () => {
    assert.equal(manifest.assets.length, manifest.assetCount)
  })

  it('carries the AI disclosure, which the credits page renders verbatim', () => {
    assert.ok(manifest.disclosure.length > 0)
    assert.match(manifest.disclosure, /AI-generated/i)
  })

  it('carries a licence', () => {
    assert.ok(manifest.licence.length > 0)
  })
})

describe('the generated catalogue', () => {
  it('is exactly what tools/sync-art.mjs would write today', () => {
    // A stale catalogue points at pictures that moved. `pnpm sync-art` regenerates it; this fails
    // CI rather than letting the drift ship.
    assert.equal(read('src/art/catalogue.ts'), render(manifest))
  })

  it('has one entry per manifest asset', () => {
    assert.equal(ART.length, manifest.assets.length)
    assert.equal(catalogueFrom(manifest).length, manifest.assets.length)
  })

  it('serves every path from /art/, never from the repository-relative assets/', () => {
    for (const entry of ART) {
      assert.ok(entry.path.startsWith('/art/'), `${entry.path} is not served from /art/`)
      assert.ok(!entry.path.startsWith('/art/assets/'), `${entry.path} kept the manifest prefix`)
    }
  })

  it('carries no FLUX prompt — 776 kB of prose stays out of the bundle', () => {
    const source = read('src/art/catalogue.ts')
    assert.ok(!source.includes('monster-collecting role-playing game'), 'a prompt leaked into the catalogue')
    assert.ok(source.length < 60_000, `the catalogue is ${source.length} bytes; it should be tens of kB`)
  })
})

describe('every file the catalogue names exists on disk', () => {
  /**
   * One test, 134 files, and every missing one NAMED.
   *
   * Deliberately not a `for` loop emitting 134 near-identical cases: that inflates a suite's count
   * without adding a single independent thing being checked, and a suite whose number is padding
   * is a suite nobody trusts the number of. What matters is that a failure says exactly which
   * files are gone, which the collected list does.
   */
  it('resolves all of them', () => {
    const missing = ART.filter((e) => !existsSync(fileURLToPath(new URL(`public${e.path}`, root)))).map(
      (e) => e.path,
    )
    assert.deepEqual(missing, [], `catalogued but not on disk: ${missing.join(', ')}`)
    assert.ok(ART.length > 100, 'the catalogue is too small for that assertion to have meant anything')
  })
})

describe('every species the game knows has art, at both sizes', () => {
  it('has 50 species in the local content copy', () => {
    assert.equal(species.length, 50)
  })

  it('has a 256 thumbnail for every one of them', () => {
    const missing = species.filter((s) => !speciesArt(s.id, 'thumb')).map((s) => s.id)
    assert.deepEqual(missing, [], `no thumbnail: ${missing.join(', ')}`)
  })

  it('has a 1024 portrait for every one of them', () => {
    const missing = species.filter((s) => !speciesArt(s.id, 'portrait')).map((s) => s.id)
    assert.deepEqual(missing, [], `no portrait: ${missing.join(', ')}`)
  })

  it('has art for exactly the species the content names — no orphans either way', () => {
    const withArt = new Set(speciesWithArt())
    const known = new Set(species.map((s) => s.id))
    const orphanArt = [...withArt].filter((id) => !known.has(id))
    const missing = [...known].filter((id) => !withArt.has(id))
    assert.deepEqual(missing, [], 'species with no art')
    assert.deepEqual(orphanArt, [], 'art for a species the content does not name')
  })

  it('serves the thumbnail from the 256 file and the portrait from the 1024 one', () => {
    // The dex grid asks for `thumb`; getting a 584 kB portrait back fifty times over is the
    // performance bug this distinction exists to prevent.
    assert.match(speciesArt('cindercub', 'thumb') ?? '', /-256x256\.png$/)
    assert.match(speciesArt('cindercub', 'portrait') ?? '', /-1024x1024\.png$/)
  })

  it('returns null for a species that does not exist, rather than a placeholder path', () => {
    assert.equal(speciesArt('not_a_species', 'thumb'), null)
  })
})

describe('every element has an icon', () => {
  it('has nine elements', () => {
    assert.equal(ELEMENTS.length, 9)
  })

  it('has an icon for every one of them', () => {
    const missing = ELEMENTS.filter((e) => !typeIcon(e))
    assert.deepEqual(missing, [], `no icon: ${missing.join(', ')}`)
  })

  it('returns null for an element that does not exist', () => {
    assert.equal(typeIcon('plasma'), null)
  })
})

describe('every region has keyart', () => {
  it('has six regions', () => {
    assert.equal(campaign.regions.length, 6)
  })

  it('has keyart for every one of them', () => {
    const missing = campaign.regions.filter((r) => !biomeKeyart(r.id)).map((r) => r.id)
    assert.deepEqual(missing, [], `no keyart: ${missing.join(', ')}`)
  })
})

describe('the UI chrome the components ask for', () => {
  // Every slug named in src/components. A rename in the asset set that broke one of these would
  // otherwise present as a glyph quietly not appearing.
  const slugs = [
    'glyph-resonance',
    'glyph-sync',
    'glyph-temperament-harmony',
    'glyph-temperament-ferocity',
    'glyph-satchel',
  ]
  it('all exist', () => {
    const missing = slugs.filter((slug) => !chrome(slug))
    assert.deepEqual(missing, [], `asked for by a component, not in the art set: ${missing.join(', ')}`)
  })
})

describe('the title art the pages ask for', () => {
  it('all exist', () => {
    const missing = ['wordmark', 'mark', 'hero'].filter((slug) => !titleArt(slug))
    assert.deepEqual(missing, [], `asked for by a page, not in the art set: ${missing.join(', ')}`)
  })

  it('the favicon and the preload in index.html point at real files', () => {
    const html = read('index.html')
    for (const match of html.matchAll(/href="(\/art\/[^"]+)"/g)) {
      const path = match[1] as string
      assert.ok(existsSync(fileURLToPath(new URL(`public${path}`, root))), `${path} is referenced by index.html and is missing`)
    }
  })
})

describe('accents', () => {
  it('reports the art accent recorded per element', () => {
    assert.equal(accentFor('types', 'ember'), '#ff6b4a')
    assert.equal(accentFor('types', 'frost'), '#8ee7ff')
  })

  it('is null for something with none', () => {
    assert.equal(accentFor('types', 'plasma'), null)
  })
})
