/**
 * Items, as the engine understands them.
 *
 * `emberkin/src/engine/items.ts` is the authority and it is a hard-coded switch, not data — there
 * is no items JSON and no route that serves one. So this is a transcription, and the citation
 * is per line rather than per file:
 *
 *   RESONATORS                         engine/items.ts:4
 *   healAmount potion 40               engine/items.ts:8
 *              super_potion 90         engine/items.ts:9
 *              hyper_potion 160        engine/items.ts:10
 *              max_potion 99999        engine/items.ts:11
 *   curesStatus salve, full_heal       engine/items.ts:18
 *   resonatorPower 1.0 / 1.5 / 255.0   engine/items.ts:26-30
 *   displayName                        engine/items.ts:35-46
 *
 * An id this transcription does not know falls through to itself, exactly as `displayName` does
 * (`engine/items.ts:45`) — so a new item added to the service shows up in the satchel as its id
 * rather than vanishing from a screen that is supposed to list everything you are carrying.
 */

export const RESONATORS = ['resonator', 'greater_resonator', 'master_resonator'] as const

const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  potion: 'Potion',
  super_potion: 'Super Potion',
  hyper_potion: 'Hyper Potion',
  max_potion: 'Max Potion',
  salve: 'Salve',
  full_heal: 'Full Heal',
  resonator: 'Resonator',
  greater_resonator: 'Greater Resonator',
  master_resonator: 'Master Resonator',
}

const HEAL_AMOUNTS: Readonly<Record<string, number>> = {
  potion: 40,
  super_potion: 90,
  hyper_potion: 160,
  max_potion: 99999,
}

export function itemName(id: string): string {
  return DISPLAY_NAMES[id] ?? id
}

export function isResonator(id: string): boolean {
  return (RESONATORS as readonly string[]).includes(id)
}

export function healAmount(id: string): number {
  return HEAL_AMOUNTS[id] ?? 0
}

export function curesStatus(id: string): boolean {
  return id === 'salve' || id === 'full_heal'
}

/**
 * What an item does, in one sentence.
 *
 * `null` for an id this build does not know, and the satchel renders "this build does not know
 * what this does" rather than an empty cell — the difference between "no effect" and "unknown"
 * being exactly the sort of thing rule 4 is about.
 *
 * `max_potion` says "fully" rather than "99999 HP", because 99999 is a sentinel standing in for
 * "all of it" and printing it would be printing an implementation detail as a number.
 */
export function itemEffect(id: string): string | null {
  if (id === 'max_potion') return 'Restores a Kin fully.'
  const heal = healAmount(id)
  if (heal > 0) return `Restores ${heal} HP.`
  if (curesStatus(id)) return 'Clears a status condition.'
  if (isResonator(id)) {
    const power = id === 'master_resonator' ? 'all but guaranteed' : id === 'greater_resonator' ? 'much better' : 'baseline'
    return `Thrown at a wild Kin to bond with it — catch chance ${power}.`
  }
  return null
}

export type ItemCategory = 'healing' | 'status' | 'resonator' | 'other'

export function categoryOf(id: string): ItemCategory {
  if (isResonator(id)) return 'resonator'
  if (healAmount(id) > 0) return 'healing'
  if (curesStatus(id)) return 'status'
  return 'other'
}

export const CATEGORY_LABELS: Readonly<Record<ItemCategory, string>> = {
  resonator: 'Resonators',
  healing: 'Healing',
  status: 'Remedies',
  other: 'Other',
}
