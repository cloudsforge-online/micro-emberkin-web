/**
 * The content: the five requests, and the reconciliation between two copies of the truth.
 *
 * The canonical content is `micro-emberkin`'s. This bundle carries a RENDERING copy because the
 * service publishes only a four-field dex (`emberkin/src/server.ts`) and a client cannot draw
 * a creature from four fields. Two copies drift, so `reconcile` names every way they can, and each
 * way is a different problem with a different honest response.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { displayName, loadContent, reconcile, type Content } from '../src/lib/content.ts'
import type { DexEntry } from '../src/lib/emberkin.ts'

const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8')

/** Serve the real files from disk, so the test drives the real shapes rather than invented ones. */
function diskFetch(calls: string[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    const name = url.split('/').pop() as string
    return new Response(read(`public/game/data/${name}`), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

describe('loadContent — the requests', () => {
  it('asks for exactly the five files, from /game/data', async () => {
    const calls: string[] = []
    await loadContent(diskFetch(calls))
    assert.deepEqual(calls.sort(), [
      '/game/data/campaign.json',
      '/game/data/moves.json',
      '/game/data/species.json',
      '/game/data/types.json',
      '/game/data/visuals.json',
    ])
  })

  it('asks for all five in ONE round, not serially', async () => {
    // Five serial round trips on a mobile connection is most of a second before the title paints.
    let concurrent = 0
    let peak = 0
    const impl = (async (input: RequestInfo | URL) => {
      concurrent += 1
      peak = Math.max(peak, concurrent)
      await new Promise((r) => setTimeout(r, 1))
      concurrent -= 1
      const name = String(input).split('/').pop() as string
      return new Response(read(`public/game/data/${name}`), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    await loadContent(impl)
    assert.equal(peak, 5)
  })

  it('sends no credentials to the static file server', async () => {
    let init: RequestInit | undefined
    const impl = (async (input: RequestInfo | URL, i?: RequestInit) => {
      init = i
      const name = String(input).split('/').pop() as string
      return new Response(read(`public/game/data/${name}`), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    await loadContent(impl)
    assert.equal(init?.credentials, 'omit')
  })

  it('throws, naming the file, when one of them 404s', async () => {
    const impl = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith('moves.json')) return new Response('', { status: 404 })
      const name = String(input).split('/').pop() as string
      return new Response(read(`public/game/data/${name}`), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    await assert.rejects(() => loadContent(impl), /moves\.json answered 404/)
  })

  it('indexes species, visuals and moves by id', async () => {
    const content = await loadContent(diskFetch([]))
    assert.equal(content.speciesById.get('cindercub')?.name, 'Cindercub')
    assert.equal(content.visualById.get('cindercub')?.archetype, 'quadruped')
    assert.equal(content.moveById.get('ember_scratch')?.name, 'Ember Scratch')
  })

  it('loads the real content: 50 species, 47 moves, 9 elements, 6 regions', async () => {
    const content = await loadContent(diskFetch([]))
    assert.equal(content.species.length, 50)
    assert.equal(content.visuals.length, 50)
    assert.equal(content.moves.length, 47)
    assert.equal(content.types.elements.length, 9)
    assert.equal(content.campaign.regions.length, 6)
    assert.equal(content.campaign.starters.length, 3)
  })

  it('gives every species a visual spec, which the 3D rig needs', async () => {
    const content = await loadContent(diskFetch([]))
    const missing = content.species.filter((s) => !content.visualById.has(s.id)).map((s) => s.id)
    assert.deepEqual(missing, [], `no visual spec: ${missing.join(', ')}`)
  })

  it('names only moves that exist, in every learnset', async () => {
    const content = await loadContent(diskFetch([]))
    const dangling: string[] = []
    for (const species of content.species) {
      for (const entry of species.learnset) {
        if (!content.moveById.has(entry.move)) dangling.push(`${species.id}:${entry.move}`)
      }
      if (species.resonanceArt && !content.moveById.has(species.resonanceArt)) {
        dangling.push(`${species.id}:art:${species.resonanceArt}`)
      }
    }
    assert.deepEqual(dangling, [], `learnset moves that do not exist: ${dangling.join(', ')}`)
  })

  it('names only species that exist, in every evolution', async () => {
    const content = await loadContent(diskFetch([]))
    const dangling: string[] = []
    for (const species of content.species) {
      for (const evo of species.evolutions) {
        if (!content.speciesById.has(evo.into)) dangling.push(`${species.id}→${evo.into}`)
      }
    }
    assert.deepEqual(dangling, [], `evolutions into species that do not exist: ${dangling.join(', ')}`)
  })

  it('names only species that exist, in every region encounter table', async () => {
    const content = await loadContent(diskFetch([]))
    const dangling: string[] = []
    for (const region of content.campaign.regions) {
      for (const wild of region.wildKin) {
        if (!content.speciesById.has(wild.species)) dangling.push(`${region.id}:${wild.species}`)
      }
    }
    assert.deepEqual(dangling, [], `wild encounters for species that do not exist: ${dangling.join(', ')}`)
  })

  it('names only real starters', async () => {
    const content = await loadContent(diskFetch([]))
    for (const id of content.campaign.starters) {
      assert.ok(content.speciesById.has(id), `starter ${id} is not a species`)
    }
  })
})

describe('reconcile', () => {
  let content: Content
  const load = async (): Promise<Content> => (content ??= await loadContent(diskFetch([])))

  const dexOf = (c: Content): DexEntry[] =>
    c.species.map((s) => ({ id: s.id, dexNumber: s.dexNumber, name: s.name, types: s.types }))

  it('agrees when the two copies are the same', async () => {
    const c = await load()
    const r = reconcile(c, dexOf(c))
    assert.equal(r.agreed, true)
    assert.deepEqual(r.missingLocally, [])
    assert.deepEqual(r.missingArt, [])
    assert.deepEqual(r.stale, [])
    assert.deepEqual(r.typeDisagreement, [])
  })

  it('names a species the service knows that this build does not', async () => {
    const c = await load()
    const dex = [...dexOf(c), { id: 'newkin', dexNumber: 51, name: 'Newkin', types: ['ember'] }]
    const r = reconcile(c, dex)
    assert.equal(r.agreed, false)
    assert.deepEqual(r.missingLocally, [{ id: 'newkin', name: 'Newkin', dexNumber: 51 }])
  })

  it('does NOT report a service-only species as missing ART — it is missing everything', async () => {
    // Separate categories, because the honest response differs: one shows a name and a number, the
    // other shows a named gap where a picture should be.
    const c = await load()
    const dex = [...dexOf(c), { id: 'newkin', dexNumber: 51, name: 'Newkin', types: ['ember'] }]
    assert.deepEqual(reconcile(c, dex).missingArt, [])
  })

  it('names a species this build carries that the service has dropped', async () => {
    const c = await load()
    const dex = dexOf(c).filter((d) => d.id !== 'cindercub')
    const r = reconcile(c, dex)
    assert.deepEqual(r.stale, ['cindercub'])
    assert.equal(r.agreed, false)
  })

  it('names a type disagreement, and reports BOTH sides', async () => {
    const c = await load()
    const dex = dexOf(c).map((d) => (d.id === 'cindercub' ? { ...d, types: ['ember', 'gale'] } : d))
    const r = reconcile(c, dex)
    assert.equal(r.typeDisagreement.length, 1)
    assert.deepEqual(r.typeDisagreement[0], {
      id: 'cindercub',
      local: ['ember'],
      service: ['ember', 'gale'],
    })
  })

  it('treats a REORDERED dual type as a disagreement — the primary type is meaningful', async () => {
    const c = await load()
    const dual = c.species.find((s) => s.types.length > 1)
    assert.ok(dual, 'the content has no dual-type species; this test would pass vacuously')
    const dex = dexOf(c).map((d) => (d.id === dual.id ? { ...d, types: [...d.types].reverse() } : d))
    assert.equal(reconcile(c, dex).typeDisagreement.length, 1)
  })

  it('reports several disagreements at once', async () => {
    const c = await load()
    const dex = [
      ...dexOf(c).filter((d) => d.id !== 'cindercub'),
      { id: 'newkin', dexNumber: 51, name: 'Newkin', types: ['ember'] },
    ]
    const r = reconcile(c, dex)
    assert.equal(r.stale.length, 1)
    assert.equal(r.missingLocally.length, 1)
    assert.equal(r.agreed, false)
  })

  it('reports EVERY species as stale against an empty dex, rather than agreeing', async () => {
    const c = await load()
    const r = reconcile(c, [])
    assert.equal(r.stale.length, 50)
    assert.equal(r.agreed, false)
  })
})

describe('displayName', () => {
  it('prefers the local content name', async () => {
    const c = await loadContent(diskFetch([]))
    assert.equal(displayName('cindercub', c, null), 'Cindercub')
  })

  it("falls back to the service's name for a species this build lacks", () => {
    // "Aetherion — not in this build" rather than "unknown species aetherion".
    const dex: DexEntry[] = [{ id: 'newkin', dexNumber: 51, name: 'Newkin', types: [] }]
    assert.equal(displayName('newkin', null, dex), 'Newkin')
  })

  it('falls back to the id when neither copy has it, rather than to a blank', () => {
    assert.equal(displayName('mystery', null, null), 'mystery')
  })
})
