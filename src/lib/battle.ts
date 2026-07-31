/**
 * Battles: building the intent, and reading back what the server decided.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE CLIENT IS NOT AUTHORITATIVE, AND THIS FILE IS WHERE THAT IS TRUE OR NOT.
 *
 * `kindred-resonance`'s client ran the whole battle engine in the browser
 * (`web/game/engine/battle.js`, 302 lines) and wrote the result to `localStorage`. Those files are
 * deleted here. `micro-emberkin` resolves a battle from the save's party plus a seed
 * (`emberkin/src/battles.ts:124-147`) and returns a log; the browser's job is to send an intent
 * and animate the answer.
 *
 * Which raises the one interesting problem in the client: the engine is deterministic and the log
 * is a list of SENTENCES, not events. `emberkin/src/engine/battle.ts` pushes formatted lines
 * through a callback (`battles.ts:139`). So the renderer animates from the log, and the log is
 * prose. Two rules keep that honest:
 *
 *   1. The log is DISPLAYED verbatim. Every line the server wrote appears, in order, whether or
 *      not this client understood it. A parser that dropped what it could not classify would hide
 *      exactly the turn that went wrong.
 *   2. Anything parsed out of the log drives ANIMATION ONLY, and is marked `confident: false` when
 *      the line did not match. A cue that fails to parse plays a neutral beat; it never invents a
 *      number, and no number shown to the player is ever read from prose — those come from the
 *      save diff in `save.ts`.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import type { EnemySpec, KinSpec, ScriptAction, ScriptActionKind } from './emberkin.ts'
import type { Content, Region } from './content.ts'

/* ==================================================================== the intent */

/** What the player chose on one turn, before it becomes a `ScriptAction`. */
export type Intent =
  | { kind: 'move'; moveId: string }
  | { kind: 'art' }
  | { kind: 'catch'; itemId: string }
  | { kind: 'flee' }
  | { kind: 'switch'; index: number }
  | { kind: 'item'; itemId: string }

/**
 * Turn a chosen intent into the shape `POST /v1/saves/me/battles` accepts.
 *
 * `parseScript` at `emberkin/src/server.ts:498-515` accepts exactly six kinds (line 504) and picks
 * up `slot`, `move`, `item` and `index` when they are the right primitive type — silently dropping
 * anything else. Silently. So a field spelled wrong here does not fail loudly; it produces a
 * different battle. `test/battle.test.ts` asserts the emitted object key by key against that
 * parser's expectations for every intent, which is the only way that class of bug is caught.
 *
 * Note `art` carries no move id. `emberkin/src/battles.ts:74-75` maps it to the species' own
 * `resonanceArt`, so a client that named a move here would be overridden or ignored — and a UI
 * that let the player pick which Art to use would be offering a choice the server does not have.
 */
export function toScriptAction(intent: Intent): ScriptAction {
  switch (intent.kind) {
    case 'move':
      return { kind: 'move', move: intent.moveId }
    case 'art':
      return { kind: 'art' }
    case 'catch':
      return { kind: 'catch', item: intent.itemId }
    case 'flee':
      return { kind: 'flee' }
    case 'switch':
      return { kind: 'switch', index: intent.index }
    case 'item':
      return { kind: 'item', item: intent.itemId }
  }
}

export function toScript(intents: readonly Intent[]): ScriptAction[] {
  return intents.map(toScriptAction)
}

/** The six kinds, as the server enumerates them. `emberkin/src/server.ts:504`. */
export const SCRIPT_KINDS: readonly ScriptActionKind[] = ['move', 'art', 'catch', 'flee', 'switch', 'item']

/* ==================================================================== the encounter */

/**
 * Roll a wild encounter for a region, from that region's own table.
 *
 * This picks WHICH species and WHAT LEVEL to submit — and that is a client choice, which deserves
 * saying plainly: the server accepts whatever enemy party the client names
 * (`emberkin/src/server.ts:475-496` validates the shape, not the fairness). A client could submit
 * a level-2 enemy every time. It would gain nothing worth having — there is no ladder, no reward
 * table and no economy attached to a wild win — and cheapening one's own single-player game is not
 * a threat model. What the server does defend is everything that matters: the player's own party
 * comes from the authoritative save, the resolution is its engine's, and the save it writes back
 * is the one it computed.
 *
 * Recorded here rather than left implicit, because "the client picks the encounter" is exactly the
 * kind of thing that looks like an oversight to the next reader.
 *
 * The weights are `campaign.json`'s. `random` is injectable so the test can drive every branch of
 * the weighted pick rather than sampling and hoping.
 */
export function rollEncounter(region: Region, random: () => number = Math.random): KinSpec | null {
  const table = region.wildKin
  if (table.length === 0) return null
  const total = table.reduce((sum, e) => sum + e.weight, 0)
  if (total <= 0) return null

  let roll = random() * total
  for (const entry of table) {
    roll -= entry.weight
    if (roll < 0) return pickLevel(entry, random)
  }
  // Floating-point can leave `roll` a hair above zero after the last subtraction. Falling back to
  // the last entry is correct; returning null here would drop an encounter roughly once in 2^50.
  const last = table[table.length - 1]
  return last ? pickLevel(last, random) : null
}

function pickLevel(entry: { species: string; levels: readonly number[] }, random: () => number): KinSpec {
  const lo = entry.levels[0] ?? 1
  const hi = entry.levels[1] ?? lo
  const span = Math.max(0, hi - lo)
  return { species: entry.species, level: lo + Math.floor(random() * (span + 1)) }
}

/**
 * The enemy to submit for a wild encounter.
 *
 * `isWild: true` matters — `emberkin/src/battles.ts:135` passes it into `BattleSide`, and a wild
 * side is the only one that can be caught. Submitting a wild encounter as a trainer battle would
 * make the catch action silently do nothing.
 */
export function wildEnemy(spec: KinSpec): EnemySpec {
  return { name: 'Wild', isWild: true, party: [spec] }
}

/* ==================================================================== reading the log */

/** One line of the server's battle log, plus whatever animation cue could be read from it. */
export interface LogBeat {
  /** The server's line, verbatim and always present. */
  readonly text: string
  /** What to animate. `null` when the line was not recognised — the line still displays. */
  readonly cue: BattleCue | null
}

export type BattleCue =
  | { kind: 'attack' }
  | { kind: 'art' }
  | { kind: 'faint' }
  | { kind: 'catch' }
  | { kind: 'critical' }
  | { kind: 'miss' }
  | { kind: 'effective'; more: boolean }
  | { kind: 'no-effect' }

/**
 * Read an animation cue out of one log line.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY PHRASE BELOW WAS READ OUT OF `emberkin/src/engine/battle.ts`, NOT GUESSED.
 *
 *   'A critical hit!'                         battle.ts:283
 *   "It's super effective!"                   engine/typechart.ts:37, logged at battle.ts:285
 *   "It's not very effective..."              engine/typechart.ts:36
 *   'It has no effect...'                     engine/typechart.ts:35
 *   "It doesn't affect <name>..."             battle.ts:278
 *   'Gotcha! <name> resonates with you now.'  battle.ts:236
 *   '<name> fainted!'                         battle.ts:403
 *   '✦ <name> channels its Resonance Art — '  battle.ts:260
 *   '<name> used <move>!'                     battle.ts:262
 *   "<name>'s attack missed!"                 battle.ts:267
 *
 * The first draft of this function matched `'was caught'` and `'unleashes'`, neither of which the
 * engine ever writes — the catch would have animated nothing and the Art would have animated as an
 * ordinary attack. That is the same class of mistake as calling a route that does not exist, one
 * layer down, so the phrases are cited like routes are.
 *
 * A line this does not recognise returns `null`: the renderer plays a neutral beat and the text is
 * still displayed. Guessing would put a faint animation on a line about the weather.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Order is load-bearing. `'<side> used <item>. <name> recovered N HP.'` (battle.ts:201) also
 * contains "used ", so the attack test requires the line to END in `!` — which move lines do and
 * item lines do not.
 */
export function cueFor(line: string): BattleCue | null {
  const t = line.toLowerCase()
  if (t.includes('critical')) return { kind: 'critical' }
  if (t.startsWith('gotcha!')) return { kind: 'catch' }
  if (t.includes('fainted')) return { kind: 'faint' }
  if (t.includes('no effect') || t.includes("doesn't affect")) return { kind: 'no-effect' }
  if (t.includes('super effective')) return { kind: 'effective', more: true }
  if (t.includes('not very effective')) return { kind: 'effective', more: false }
  if (t.includes('missed!')) return { kind: 'miss' }
  if (t.includes('resonance art')) return { kind: 'art' }
  if (/\bused .+!$/.test(t)) return { kind: 'attack' }
  return null
}

export function beatsFrom(log: readonly string[]): LogBeat[] {
  return log.map((text) => ({ text, cue: cueFor(text) }))
}

/**
 * How an outcome is said to the player.
 *
 * The five outcomes are the engine's (`emberkin/src/engine/battletypes.ts`). An outcome this
 * client does not know is echoed as itself rather than mapped to "Defeat" — a new outcome string
 * appearing on screen unchanged is a bug report; one silently rendered as a loss is not.
 */
export function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'Victory':
      return 'Victory'
    case 'Defeat':
      return 'Defeated'
    case 'Caught':
      return 'Caught'
    case 'Fled':
      return 'Got away'
    case 'Ongoing':
      return 'Unresolved — the turn limit was reached'
    default:
      return outcome
  }
}

/** Which region the save says the player is in, resolved against the campaign. */
export function currentRegion(content: Content, regionId: string): Region | null {
  return content.campaign.regions.find((r) => r.id === regionId) ?? null
}
