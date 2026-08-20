/**
 * The game's content, and the reconciliation that keeps this bundle honest about it.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THERE ARE TWO COPIES OF THE CONTENT AND THEY ARE NOT PEERS.
 *
 * The CANONICAL copy is `micro-emberkin`'s (`emberkin/src/content/gamedata.ts`). It is what
 * battles resolve against, and this client has no vote in it.
 *
 * The RENDERING copy is `public/game/data/*.json`, carried forward from `kindred-resonance`
 * `content/`. It exists because the service publishes only a thin dex — `GET /v1/content/dex`
 * returns `{id, dexNumber, name, types}` and nothing more (`emberkin/src/server.ts`) — and a
 * client cannot draw a creature, list a learnset or explain a type matchup from four fields.
 *
 * Two copies of anything drift. So the app FETCHES the service's dex on boot and reconciles:
 * anything the service knows that this bundle cannot draw is named on screen, and anything this
 * bundle carries that the service has dropped is not offered. Rule 3 of the brief — degradation,
 * not blank pages — and rule 4 — never invent a number — are both this function.
 *
 * The alternative would have been to add a fat content route to `micro-emberkin`. That repository
 * is single-owner and this one does not edit it; the gap is reported instead.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import type { DexEntry } from './emberkin.ts'
import { speciesArt } from './art.ts'
import { publicPath } from './routes.ts'

export interface StatBlock {
  readonly hp: number
  readonly attack: number
  readonly defense: number
  readonly spatk: number
  readonly spdef: number
  readonly speed: number
}

export interface LearnsetEntry {
  readonly level: number
  readonly move: string
}

export interface Evolution {
  readonly into: string
  readonly requires: Readonly<Record<string, number | string | null>>
}

/** `public/game/data/species.json`. 50 entries. */
export interface Species {
  readonly id: string
  readonly dexNumber: number
  readonly name: string
  readonly types: readonly string[]
  readonly category: string
  readonly baseStats: StatBlock
  readonly catchRate: number
  readonly growthRate: string
  readonly temperamentBias: number
  readonly learnset: readonly LearnsetEntry[]
  readonly resonanceArt: string | null
  readonly evolutions: readonly Evolution[]
  readonly lore: string
}

/** `public/game/data/visuals.json`. The art bible's body plan, used by the 3D rig. */
export interface Visual {
  readonly id: string
  readonly name: string
  readonly dexNumber: number
  readonly archetype: string
  readonly stage: string
  readonly primaryColor: string
  readonly secondaryColor: string
  readonly scale: number
  readonly emissive: boolean
  readonly silhouette: string
  readonly polyBudget: number
  readonly rig: string
}

/** `public/game/data/moves.json`. 47 entries. */
export interface Move {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly category: 'physical' | 'special' | 'status'
  readonly power: number
  readonly accuracy: number
  readonly priority: number
  readonly syncCost: number
  readonly isResonanceArt: boolean
  readonly description: string
}

export interface Region {
  readonly id: string
  readonly name: string
  readonly act: number
  readonly wildKin: readonly { species: string; levels: readonly number[]; weight: number }[]
  readonly nodes: readonly string[]
}

export interface Campaign {
  readonly title: string
  readonly startRegion: string
  readonly starters: readonly string[]
  readonly regions: readonly Region[]
}

export interface TypesData {
  readonly elements: readonly string[]
  readonly chart: Readonly<Record<string, Readonly<Record<string, number>>>>
}

export interface Content {
  readonly species: readonly Species[]
  readonly visuals: readonly Visual[]
  readonly moves: readonly Move[]
  readonly types: TypesData
  readonly campaign: Campaign
  readonly speciesById: ReadonlyMap<string, Species>
  readonly visualById: ReadonlyMap<string, Visual>
  readonly moveById: ReadonlyMap<string, Move>
}

/**
 * Where the content is served from.
 *
 * FETCHED, not imported. `species.json` and friends total 96 KB, and importing them would put all
 * of it in the entry chunk for a page that may only be showing a sign-in button. Fetched, nginx
 * serves them as immutable static files and the browser caches them across deploys of the app
 * itself.
 */
const CONTENT_BASE = publicPath('/game/data')

const FILES = ['species', 'visuals', 'moves', 'types', 'campaign'] as const

/**
 * Load the rendering content.
 *
 * A `fetch` implementation is injectable so the tests can assert the REQUESTS — the five paths, in
 * one round of five, with no credentials — rather than only the parsed result. That is the gap the
 * brief names: this estate's existing frontend tests stubbed fetch and asserted the response, and
 * both shipped route defects lived in the request.
 */
export async function loadContent(fetchImpl: typeof fetch = fetch): Promise<Content> {
  const [species, visuals, moves, types, campaign] = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetchImpl(`${CONTENT_BASE}/${name}.json`, {
        // Static content on our own origin. Sending credentials to a file server achieves nothing
        // and widens what a misconfigured cache may store.
        credentials: 'omit',
      })
      if (!res.ok) throw new Error(`content ${name}.json answered ${res.status}`)
      return res.json() as Promise<unknown>
    }),
  )

  const speciesList = species as Species[]
  const visualList = visuals as Visual[]
  const moveList = moves as Move[]

  return {
    species: speciesList,
    visuals: visualList,
    moves: moveList,
    types: types as TypesData,
    campaign: campaign as Campaign,
    speciesById: new Map(speciesList.map((s) => [s.id, s])),
    visualById: new Map(visualList.map((v) => [v.id, v])),
    moveById: new Map(moveList.map((m) => [m.id, m])),
  }
}

/**
 * What the two copies disagree about.
 *
 * Every field is a list of species ids and every one of them is a different problem:
 *
 *   `missingLocally`  the service has a species this bundle has no data for. The dex shows the
 *                     name and number the service gave, and says the rest is not in this build.
 *   `missingArt`      we have data but no picture. Renders a named gap, never a placeholder that
 *                     looks like art.
 *   `stale`           this bundle carries a species the service has dropped. Not offered anywhere;
 *                     a save that still references one is the service's problem to answer for.
 *   `typeDisagreement` same id, different types. The SERVICE's types are displayed, because damage
 *                     is computed against them; the disagreement is still surfaced, because a
 *                     player told "super effective" by a stale chart is being lied to.
 */
export interface ContentReconciliation {
  readonly missingLocally: readonly { id: string; name: string; dexNumber: number }[]
  readonly missingArt: readonly string[]
  readonly stale: readonly string[]
  readonly typeDisagreement: readonly { id: string; local: readonly string[]; service: readonly string[] }[]
  /** True when the two copies agree completely. The banner is hidden only in this case. */
  readonly agreed: boolean
}

export function reconcile(content: Content, serviceDex: readonly DexEntry[]): ContentReconciliation {
  const serviceIds = new Set(serviceDex.map((d) => d.id))

  const missingLocally = serviceDex
    .filter((d) => !content.speciesById.has(d.id))
    .map((d) => ({ id: d.id, name: d.name, dexNumber: d.dexNumber }))

  const missingArt = serviceDex
    .filter((d) => content.speciesById.has(d.id))
    .filter((d) => speciesArt(d.id, 'thumb') === null || speciesArt(d.id, 'portrait') === null)
    .map((d) => d.id)

  const stale = content.species.filter((s) => !serviceIds.has(s.id)).map((s) => s.id)

  const typeDisagreement: { id: string; local: readonly string[]; service: readonly string[] }[] = []
  for (const entry of serviceDex) {
    const local = content.speciesById.get(entry.id)
    if (!local) continue
    if (!sameTypes(local.types, entry.types)) {
      typeDisagreement.push({ id: entry.id, local: local.types, service: entry.types })
    }
  }

  return {
    missingLocally,
    missingArt,
    stale,
    typeDisagreement,
    agreed:
      missingLocally.length === 0 &&
      missingArt.length === 0 &&
      stale.length === 0 &&
      typeDisagreement.length === 0,
  }
}

/**
 * Types compared as ORDERED lists.
 *
 * Dual-type order is meaningful in this genre — the first type is the primary, and it is what a
 * portrait's tint and a species' category line are drawn from. `['ember','gale']` and
 * `['gale','ember']` are a real disagreement, not a sorting difference, so they are not sorted
 * before comparing.
 */
function sameTypes(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

/**
 * A species' display name, from whichever copy has one.
 *
 * The service's dex carries names (`emberkin/src/server.ts`), so a species missing from the
 * local content still has one — which is the difference between "Aetherion — not in this build"
 * and "unknown species aetherion".
 */
export function displayName(
  id: string,
  content: Content | null,
  serviceDex: readonly DexEntry[] | null,
): string {
  return content?.speciesById.get(id)?.name ?? serviceDex?.find((d) => d.id === id)?.name ?? id
}
