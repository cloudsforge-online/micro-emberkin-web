/**
 * The save state machine. Server-authoritative, and the word "authoritative" is doing work.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE RULE: this client never treats local state as truth.
 *
 * `kindred-resonance`'s `web/game/engine/save.js` wrote the whole game to `localStorage` and read
 * it back as fact. That file is deleted in this repository, and this one replaces it. The save
 * lives in Postgres behind `micro-emberkin` (`emberkin/src/savegame.ts:1-7`), every battle is
 * resolved there, and the party this app draws after a battle is the party the SERVER returned —
 * never a party this app computed and hoped matched.
 *
 * The distinction that makes it a state machine rather than a fetch: there are four honest
 * conditions and they are not interchangeable.
 *
 *   loading   we have not asked yet
 *   absent    we asked; this account has never started a game (a 404, `server.ts:341`)
 *   present   we have the save
 *   failed    we asked and could not find out
 *
 * `absent` and `failed` are the pair worth separating. Collapsing them shows the title screen's
 * "New game" button to a player whose save exists but whose service is down — one click from
 * overwriting nothing (the route is idempotent, `server.ts:335`) but every click from a player
 * believing their progress is gone. So `failed` says what failed and offers a retry, never a
 * fresh start.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import { noticeFor, type ErrorNotice } from './api.ts'
import { fetchSave, startGame, type SaveState } from './emberkin.ts'

export type SaveStatus = 'loading' | 'absent' | 'present' | 'failed'

export type SaveMachine =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'present'; save: SaveState }
  | { status: 'failed'; notice: ErrorNotice }

export const LOADING: SaveMachine = { status: 'loading' }

/**
 * The one write this app makes to the save that is not a battle or a cosmetic.
 *
 * `saving` is tracked separately from the machine's own status so that a failed "start game" does
 * not discard a save we already hold. A player mid-game whose cosmetic write fails should still be
 * looking at their party.
 */
export interface SaveSession {
  readonly machine: SaveMachine
  readonly busy: boolean
}

export const IDLE: SaveSession = { machine: LOADING, busy: false }

/**
 * Load the save.
 *
 * `null` from `fetchSave` is `absent`, not `failed`: the 404 at `emberkin/src/server.ts:341` is
 * what a first-time player gets, and it is the ordinary path through this function.
 */
export async function loadSave(): Promise<SaveMachine> {
  try {
    const save = await fetchSave()
    return save ? { status: 'present', save } : { status: 'absent' }
  } catch (err) {
    return { status: 'failed', notice: noticeFor(err, 'Your save could not be loaded.') }
  }
}

export interface StartGameInput {
  readonly wardenName: string
  readonly starter: string
  /** A decimal-string ulong, or omitted to let the server roll one. See `emberkin.ts`. */
  readonly seed?: string
}

/**
 * Begin a game, from an `absent` machine.
 *
 * `wasAbsent` is what the caller knew before it asked, and it is the only honest source for
 * "this is a new game": the 201/200 the service sends (`server.ts:335`) is a status the shared
 * request client does not surface. A player who reaches this from a `present` machine gets their
 * existing save back — the route is idempotent — and `created` correctly reads false.
 */
export async function beginGame(
  prior: SaveMachine,
  input: StartGameInput,
): Promise<{ machine: SaveMachine; created: boolean }> {
  const wasAbsent = prior.status === 'absent'
  try {
    const save = await startGame({
      wardenName: input.wardenName,
      starter: input.starter,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    })
    return { machine: { status: 'present', save }, created: wasAbsent }
  } catch (err) {
    // A failed start must not blank a save we already had.
    const notice = noticeFor(err, 'Your game could not be started.')
    return { machine: prior.status === 'present' ? prior : { status: 'failed', notice }, created: false }
  }
}

/**
 * Fold a server-returned save into the machine.
 *
 * Every mutation in this app goes through here, and every mutation's input is a save the SERVER
 * produced. There is deliberately no `updateSave(partial)`: a client that could patch its own copy
 * of the party is a client whose party can disagree with the one battles are resolved against, and
 * the disagreement would only surface as a wrong number on a screen nobody could explain.
 */
export function adopt(save: SaveState): SaveMachine {
  return { status: 'present', save }
}

/**
 * Apply the cosmetics map a cosmetic write returned.
 *
 * `PUT /v1/saves/me/cosmetics` answers `{equippedCosmetics}` and nothing else
 * (`emberkin/src/server.ts:406`), so this is the one place a partial update is correct — the
 * server has told us the new value of exactly one field, and re-reading the whole save to learn
 * a thing we were just told would be a round trip for nothing.
 *
 * It is still not a local computation: the map applied is the server's, byte for byte. If the
 * machine is not `present` there is nothing to fold into and the prior state is returned
 * unchanged, because inventing a save around a cosmetics map would be inventing a save.
 */
export function withCosmetics(prior: SaveMachine, equippedCosmetics: Record<string, string>): SaveMachine {
  if (prior.status !== 'present') return prior
  return { status: 'present', save: { ...prior.save, equippedCosmetics } }
}

/**
 * What a battle changed, read off the two saves.
 *
 * Not computed from the battle log — the log is prose for the player (`emberkin/src/battles.ts`
 * pushes formatted lines), and parsing prose into numbers is how a display drifts from the truth
 * it describes. Both saves came from the server; the difference between them is a fact.
 */
export interface BattleDelta {
  /** Per party slot, keyed by the Kin's species id and slot index — nicknames are not unique. */
  readonly kin: readonly KinDelta[]
  /** Species ids newly in `dexSeen`. */
  readonly newlySeen: readonly string[]
  /** Kin newly in the box — i.e. caught. */
  readonly caught: readonly string[]
}

export interface KinDelta {
  readonly slot: number
  readonly speciesId: string
  readonly name: string
  readonly resonanceBefore: number
  readonly resonanceAfter: number
  readonly temperamentBefore: number
  readonly temperamentAfter: number
  readonly levelBefore: number
  readonly levelAfter: number
  readonly hpBefore: number
  readonly hpAfter: number
}

/**
 * Diff two saves.
 *
 * Slots are matched by INDEX and confirmed by species id. A slot whose species changed is a
 * different Kin — a switch reordering the party, or an evolution — and reporting a Resonance
 * "change" across two different creatures would be a fabricated number. Such a slot is omitted;
 * the screen that renders this says what it does not know rather than guessing.
 */
export function battleDelta(before: SaveState, after: SaveState): BattleDelta {
  const kin: KinDelta[] = []
  for (let slot = 0; slot < after.party.length; slot += 1) {
    const now = after.party[slot]
    const was = before.party[slot]
    if (!now || !was) continue
    if (now.speciesId !== was.speciesId) continue
    kin.push({
      slot,
      speciesId: now.speciesId,
      name: now.nickname ?? now.speciesId,
      resonanceBefore: was.resonance,
      resonanceAfter: now.resonance,
      temperamentBefore: was.temperament,
      temperamentAfter: now.temperament,
      levelBefore: was.level,
      levelAfter: now.level,
      hpBefore: was.currentHp,
      hpAfter: now.currentHp,
    })
  }

  const seenBefore = new Set(before.dexSeen)
  return {
    kin,
    newlySeen: after.dexSeen.filter((id) => !seenBefore.has(id)),
    // The box is an APPEND-ONLY array with no ids (`emberkin/src/savegame.ts:41`), and the only
    // thing that writes it is a catch, which pushes (`emberkin/src/battles.ts:155`). So the new
    // entries are the tail past the old length. Matching by value instead would fail on the case
    // that matters least and confuses most — catching a second identical Kin.
    caught: after.box.slice(before.box.length).map((k) => k.speciesId),
  }
}
