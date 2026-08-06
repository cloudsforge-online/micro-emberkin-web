/**
 * `micro-emberkin`, as this client calls it.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY FUNCTION HERE CITES THE LINE OF `emberkin/src/server.ts` IT WAS VERIFIED AGAINST.
 *
 * This estate has shipped two clients written against routes that did not exist:
 *
 *   `micro-wallet` called `/v1/quotes`; pricing serves `/rates`.
 *   `micro-market` called `/v1/decisions/market.listing`; `micro-policy` has no `/v1` routes at
 *   all — and because policy treats a 404 as `peerDecided`, that returned **403 on every listing**
 *   and closed the marketplace. A human reading the other side's route table found it.
 *
 * Both survived review because the call site read like an ordinary fetch. So the citation is the
 * mechanism: a route string in this file is a claim about a specific line of another repository,
 * and `test/emberkin-routes.test.ts` asserts that the claim is spelled the way the route table
 * compiles it. The routes were read at `emberkin` commit — see README — and the whole table is:
 *
 *   GET  /livez                        server.ts
 *   GET  /readyz                       server.ts
 *   GET  /metrics                      server.ts
 *   POST /v1/events                    server.ts   webhook; signature-checked, NOT for a browser
 *   POST /v1/saves                     server.ts
 *   GET  /v1/saves/me                  server.ts
 *   POST /v1/saves/me/battles          server.ts
 *   PUT  /v1/saves/me/cosmetics        server.ts
 *   GET  /v1/saves/me/achievements     server.ts
 *   GET  /v1/content/dex               server.ts
 *
 * There are ten routes and there is no eleventh. In particular there is NO route that writes
 * `currentRegion`, `storyProgress`, `playtimeSeconds`, `inventory` or `seals`, and no route that
 * lists the account's cosmetic entitlements. Both gaps are handled honestly below rather than
 * papered over, and both are reported upstream rather than worked around in `micro-emberkin` —
 * that repository is single-owner.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import { ApiError, emberkin } from './api.ts'

/* ==================================================================== the wire shapes */

/**
 * One Kin at rest, exactly as `serializeSave` puts it on the wire.
 *
 * `emberkin/src/engine/saves.ts` (`KinSave`), reached through
 * `emberkin/src/server.ts` (`serializeSave`), which passes `save.party` and `save.box`
 * through untouched.
 *
 * `sync` is deliberately absent: `emberkin/src/engine/kin.ts` documents it as "resets each
 * battle" and `kinToSave` (`engine/saves.ts`) does not persist it. A party screen therefore
 * cannot show a Sync value, and must not invent one — see `resonance.ts`.
 */
export interface KinSave {
  readonly speciesId: string
  /** null means "follows the species name" — `engine/saves.ts`. Not "unknown". */
  readonly nickname: string | null
  readonly level: number
  readonly xp: number
  /** 0..100, persistent. `engine/kin.ts`. */
  readonly resonance: number
  /** -100 (Harmony) .. +100 (Ferocity). `engine/kin.ts`. */
  readonly temperament: number
  readonly attunement: Readonly<Record<string, number>>
  readonly moves: readonly string[]
  readonly heldItem: string | null
  readonly currentHp: number
  readonly status: string
}

/**
 * The save, as `GET /v1/saves/me` and `POST /v1/saves` return it.
 *
 * Field for field `emberkin/src/server.ts`. `seed` is a STRING there
 * (`save.seed.toString()`, line 521) because it is a ulong that does not survive a JSON number,
 * and it stays a string here for the same reason.
 */
export interface SaveState {
  readonly userId: string
  readonly wardenName: string
  readonly seed: string
  readonly currentRegion: string
  readonly storyProgress: number
  readonly playtimeSeconds: number
  readonly party: readonly KinSave[]
  readonly box: readonly KinSave[]
  readonly inventory: Readonly<Record<string, number>>
  readonly seals: readonly string[]
  readonly dexSeen: readonly string[]
  readonly equippedCosmetics: Readonly<Record<string, string>>
  readonly saveVersion: number
}

/** One member of a submitted enemy party. `emberkin/src/server.ts` (`parseEnemy`). */
export interface KinSpec {
  readonly species: string
  readonly level: number
  readonly resonance?: number
  readonly temperament?: number
  readonly nickname?: string
}

/** The enemy a battle is submitted against. `emberkin/src/server.ts`. */
export interface EnemySpec {
  /** Defaults to 'Wild' server-side (line 478) — sent explicitly so the log names it. */
  readonly name: string
  readonly isWild: boolean
  readonly party: readonly KinSpec[]
}

/**
 * One submitted turn.
 *
 * The six kinds are enumerated at `emberkin/src/server.ts`; anything else is a 400. `art` is
 * the Resonance Art, which the server maps to the species' own art
 * (`emberkin/src/battles.ts`) rather than to a move the client names.
 */
export type ScriptActionKind = 'move' | 'art' | 'catch' | 'flee' | 'switch' | 'item'

export interface ScriptAction {
  readonly kind: ScriptActionKind
  readonly slot?: number
  readonly move?: string
  readonly item?: string
  readonly index?: number
}

/** What `POST /v1/saves/me/battles` answers. `emberkin/src/server.ts`. */
export interface BattleResult {
  readonly battleId: string
  /** `Ongoing | Victory | Defeat | Caught | Fled` — `emberkin/src/engine/battletypes.ts`. */
  readonly outcome: string
  readonly turns: number
  /** True when this submission REPLAYED a recorded battle rather than resolving a new one. */
  readonly replayed: boolean
  readonly log: readonly string[]
  readonly unlocked: readonly UnlockedAchievement[]
}

export interface UnlockedAchievement {
  readonly code: string
  readonly name: string
  readonly points: number
}

/** One row of `GET /v1/saves/me/achievements`. `emberkin/src/server.ts`. */
export interface AchievementRow {
  readonly code: string
  readonly name: string
  readonly points: number
  readonly unlockedAt: string
  /** Whether worlds has taken delivery of the badge. `server.ts` — `delivered_at !== null`. */
  readonly delivered: boolean
}

/** One row of `GET /v1/content/dex`. `emberkin/src/server.ts`. */
export interface DexEntry {
  readonly id: string
  readonly dexNumber: number
  readonly name: string
  readonly types: readonly string[]
}

/* ==================================================================== the calls */

/**
 * Start a new game.
 *
 * `POST /v1/saves` — `emberkin/src/server.ts`.
 *
 * Body: `wardenName` and `starter` are required strings (`requireString`, lines 325-326, throwing
 * a 400 on an empty or non-string field via `server.ts`). `seed` is optional and must be a
 * DECIMAL STRING, not a number: `readOptionalSeed` (`server.ts`) tests it against
 * `/^\d{1,20}$/` and rejects anything else, because a ulong seed does not survive a JSON number.
 *
 * Answers **201 when it created a save and 200 when one already existed** (`server.ts`), and
 * both carry the save. It is therefore idempotent by design: a returning player who hits "new
 * game" is handed their existing save rather than a fresh one, and nothing is overwritten.
 *
 * This returns only the save. The 201/200 distinction is real but is not in the body, and the
 * shared request client returns bodies; rather than widen every call site for one caller, the
 * state machine in `save.ts` derives "this was new" from what it already knows — whether
 * `fetchSave()` had answered `null` a moment earlier. That is the same fact from a source this
 * function does not have to lie about.
 */
export function startGame(input: { wardenName: string; starter: string; seed?: string }): Promise<SaveState> {
  return emberkin<SaveState>('/v1/saves', {
    method: 'POST',
    body: {
      wardenName: input.wardenName,
      starter: input.starter,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    },
  })
}

/**
 * The signed-in account's save, or `null` when it has none.
 *
 * `GET /v1/saves/me` — `emberkin/src/server.ts`.
 *
 * A 404 here is NOT an error state. Line 341 returns `not_found` with "no save for this account"
 * for a player who has never started a game, which is the ordinary first visit. Mapping it to
 * `null` is what lets the app show the title screen instead of a failure — every OTHER 404 from
 * this base would be a routing bug and is still thrown.
 */
export async function fetchSave(): Promise<SaveState | null> {
  try {
    return await emberkin<SaveState>('/v1/saves/me')
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * Submit a battle and receive the resolved result.
 *
 * `POST /v1/saves/me/battles` — `emberkin/src/server.ts`.
 *
 * ## The client is not authoritative
 * The submission names an ENEMY and a SCRIPT of intents. The server restores the player's party
 * from the authoritative save, rolls the enemy from the seed, runs the deterministic engine and
 * returns the log (`emberkin/src/battles.ts`). Nothing this client computes affects the
 * outcome, and the party it renders afterwards is the server's, re-read from the save.
 *
 * ## The Idempotency-Key is mandatory
 * `server.ts` rejects a submission without one with a 400, and the recorded battle is
 * keyed on `(user, key)` so that a retry REPLAYS rather than resolving — and double-applying — a
 * second battle (`battles.ts`). The caller supplies the key and must reuse the SAME key
 * when retrying the same intent; `newIdempotencyKey()` below exists so that "the same intent"
 * is a decision the caller makes once, deliberately.
 *
 * ## `seed` is a string
 * Same `readOptionalSeed` as `startGame` (`server.ts`, `465-473`). Omitted, the server uses
 * the save's own seed (`battles.ts`).
 */
export function submitBattle(
  idempotencyKey: string,
  input: { enemy: EnemySpec; script?: readonly ScriptAction[]; seed?: string; maxTurns?: number },
): Promise<BattleResult> {
  return emberkin<BattleResult>('/v1/saves/me/battles', {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: {
      enemy: input.enemy,
      ...(input.script !== undefined ? { script: input.script } : {}),
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
      ...(input.maxTurns !== undefined ? { maxTurns: input.maxTurns } : {}),
    },
  })
}

/**
 * Equip a cosmetic, or clear a slot.
 *
 * `PUT /v1/saves/me/cosmetics` — `emberkin/src/server.ts`.
 *
 * Body is `{slot, itemUrn}` where `itemUrn` is a string OR **explicitly null** to clear the slot;
 * `undefined` is a 400 (`server.ts`). So `null` is sent as `null` and never omitted — the
 * usual "drop undefined fields" spread would turn "take this off" into a bad request.
 *
 * ## This write fails CLOSED
 * `server.ts` maps a billing outage to **503 `entitlements_unavailable`** — "ask again
 * later", never "wear it anyway" — and an unowned item to **403 `cosmetic_not_owned`**
 * (`server.ts`, which also increments `emberkin_cosmetic_refusals_total`; a non-zero
 * counter means a client believes it may equip something it does not own). Both are surfaced to
 * the player as themselves. Neither is retried automatically.
 *
 * ## And it can never change a stat
 * By construction, not by promise: `emberkin/src/cosmetics.ts` writes only
 * `saves.equipped_cosmetics`, and the engine reads stats from species base stats, per-instance
 * Attunement and Resonance — none of which a cosmetic can reach. `entitlements.ts` in this
 * repository holds the client half of that rule.
 */
export function equipCosmetic(slot: string, itemUrn: string | null): Promise<{ equippedCosmetics: Record<string, string> }> {
  return emberkin<{ equippedCosmetics: Record<string, string> }>('/v1/saves/me/cosmetics', {
    method: 'PUT',
    body: { slot, itemUrn },
  })
}

/**
 * The account's unlocked achievements, newest first.
 *
 * `GET /v1/saves/me/achievements` — `emberkin/src/server.ts`. Ordering is the server's
 * (`order by unlocked_at desc`, line 413) and is not re-sorted here.
 */
export async function fetchAchievements(): Promise<readonly AchievementRow[]> {
  const body = await emberkin<{ achievements?: AchievementRow[] }>('/v1/saves/me/achievements')
  // `?? []` rather than trusting the key. The shared request client returns `undefined` for a 204
  // and for a non-JSON 200 (`api.ts`: content-length 0, or a content-type that is not JSON), and a
  // proxy in front of the service can produce either. Without this, every caller's `.map` throws
  // on a response that was merely empty.
  return body?.achievements ?? []
}

/**
 * The canonical dex: every species the SERVICE knows.
 *
 * `GET /v1/content/dex` — `emberkin/src/server.ts`.
 *
 * It returns `{id, dexNumber, name, types}` and nothing else (line 434) — no base stats, no
 * learnsets, no visual spec. Those live in this repository's carried-forward `public/game/data`,
 * which is a RENDERING copy, and the two can drift. `content.ts` reconciles them and names any
 * species the service knows that this bundle cannot draw, rather than rendering a hole.
 *
 * Public and unauthenticated: the handler takes no principal (line 431 destructures `_ctx`).
 */
export async function fetchDex(): Promise<readonly DexEntry[]> {
  const body = await emberkin<{ dex?: DexEntry[] }>('/v1/content/dex', { auth: false })
  // See `fetchAchievements`: an empty or non-JSON 200 must not become a TypeError three layers up.
  return body?.dex ?? []
}

/**
 * Is the service ready?
 *
 * `GET /readyz` — `emberkin/src/server.ts`, which answers **503 with a body** when it is not
 * (line 242). Used only by the degradation banner, so a 503 is a report rather than a throw.
 */
export async function fetchReadiness(): Promise<{ ready: boolean }> {
  try {
    const body = await emberkin<{ ready?: boolean }>('/readyz', { auth: false })
    return { ready: body?.ready === true }
  } catch {
    return { ready: false }
  }
}

/* ==================================================================== idempotency */

/**
 * A fresh key for a NEW battle submission.
 *
 * Deliberately not derived from the request body. The server already fingerprints the body into
 * the recorded row; what the key must express is the player's INTENT — "this attack, once" — so
 * that a network retry replays and a second, identical attack a minute later resolves separately.
 * A content hash would silently merge the two and the player would watch the second attack do
 * nothing.
 *
 * `crypto.randomUUID` is present in every browser this app supports and in Node 22, where the
 * tests run. The fallback exists for a non-secure context (plain http on a LAN address), where
 * `crypto` is defined but `randomUUID` is not.
 */
export function newIdempotencyKey(): string {
  const c: Partial<Crypto> | undefined = typeof crypto === 'undefined' ? undefined : crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  return `ek-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
