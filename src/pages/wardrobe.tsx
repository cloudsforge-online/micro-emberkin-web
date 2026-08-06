/**
 * The wardrobe: cosmetics you own, and the sentence that has to be on this page.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * NONE OF THIS CHANGES A NUMBER, AND THE PAGE SAYS SO ONCE, PLAINLY.
 *
 * 19 §1.2: monetisation is cosmetics and season passes, "never stat advantage". The service
 * enforces it by absence — `emberkin/src/cosmetics.ts` writes `equipped_cosmetics` and
 * nothing else — and this repository enforces it with a type that has no stat field and a test
 * that applies every item to a Kin and asserts nothing moved (`lib/cosmetics.ts`).
 *
 * What is left for the PAGE to get right is the claim. A shop that hedges — "cosmetic (may affect
 * appearance only)" — is a shop that expects to be asked. This one states it, in the lede, in the
 * copy under every item, and once more beside the season pass.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The two failure states are also not the same and are not collapsed:
 *   billing did not answer  → "we could not check what you own", with the request id.
 *   billing answered, empty → "you own no cosmetics yet".
 * The first must never render as the second. A player who bought something yesterday and is told
 * they own nothing will read it as a theft.
 */
import { useState } from 'react'
import { useGame } from '../lib/game.tsx'
import { Failed, Loading } from '../components/states.tsx'
import { ApiError, noticeFor, type ErrorNotice } from '../lib/api.ts'
import { equipCosmetic } from '../lib/emberkin.ts'
import { withCosmetics } from '../lib/save.ts'
import {
  itemsForSlot,
  SLOT_LABELS,
  SLOTS,
  isSeasonPass,
  wardrobeFrom,
  type CosmeticSlot,
} from '../lib/cosmetics.ts'

export function WardrobePage() {
  const { save, entitlements, entitlementsAt, reloadEntitlements, setSave } = useGame()
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<ErrorNotice | null>(null)

  if (save.status === 'loading' || entitlements.status === 'loading') {
    return <Loading label="Checking what you own" />
  }
  if (save.status === 'failed') {
    return <Failed notice={save.notice} title="We could not read your game" />
  }
  if (save.status === 'absent') {
    return (
      <section className="ek-page">
        <h1>Wardrobe</h1>
        <p>You have not started a game. Somebody has to wear these, and you have no Warden yet.</p>
      </section>
    )
  }

  const owned = entitlements.data ?? []
  const items = wardrobeFrom(owned)
  const passes = owned.filter((e) => e.active && isSeasonPass(e.sku))
  const equipped = save.save.equippedCosmetics

  async function apply(slot: CosmeticSlot, itemUrn: string | null) {
    setBusy(`${slot}:${itemUrn ?? 'clear'}`)
    setFailure(null)
    try {
      const answer = await equipCosmetic(slot, itemUrn)
      setSave(withCosmetics(save, answer.equippedCosmetics))
    } catch (err) {
      // The two refusals the service defines are surfaced as themselves. A 503 here is billing
      // being unreachable and the write FAILING CLOSED (`emberkin/src/server.ts`) — "ask
      // again later", never "wear it anyway" — and it is not retried automatically, because an
      // automatic retry into a service that is refusing is how a degraded shop becomes an outage.
      const notice =
        err instanceof ApiError && err.code === 'entitlements_unavailable'
          ? {
              message: 'We cannot reach the record of what you have bought, so we changed nothing rather than guess. Try again shortly.',
              requestId: err.requestId,
              forbidden: false,
            }
          : err instanceof ApiError && err.code === 'cosmetic_not_owned'
            ? {
                message: 'Your account does not have that one. Nothing changed.',
                requestId: err.requestId,
                forbidden: true,
              }
            : noticeFor(err, 'That would not go on.')
      setFailure(notice)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="ek-page">
      <header className="ek-page__head">
        <h1>Wardrobe</h1>
        <p className="ek-page__lede">
          Everything in here is about how the game looks.{' '}
          <strong>Not one item touches a number</strong> — not a stat, not a catch rate, not a
          Resonance gain. That is a rule of the game, not a promise this page is making on its
          behalf. What you own sits on your Forge Worlds account, so it is yours in every title.
        </p>
      </header>

      {entitlements.status === 'failed' && entitlements.error ? (
        <Failed
          notice={entitlements.error}
          title="We could not check what you have bought"
          onRetry={() => void reloadEntitlements()}
        />
      ) : (
        <>
          {entitlementsAt ? (
            <p className="ek-asof">
              As your account stood at <time dateTime={entitlementsAt}>{entitlementsAt}</time>.
            </p>
          ) : null}

          {failure ? <Failed notice={failure} title="That did not stick" /> : null}

          {items.length === 0 && passes.length === 0 ? (
            <p className="ek-empty">You own no cosmetics yet.</p>
          ) : null}

          {passes.length > 0 && (
            <section className="ek-pass">
              <h2>Season pass</h2>
              <ul>
                {passes.map((p) => (
                  <li key={p.id}>
                    <strong>{p.sku}</strong> — granted{' '}
                    <time dateTime={p.grantedAt}>{p.grantedAt}</time>
                    {p.expiresAt ? (
                      <>
                        , until <time dateTime={p.expiresAt}>{p.expiresAt}</time>
                      </>
                    ) : null}
                    . It unlocks a cosmetic track. It does not change how a Kin fights.
                  </li>
                ))}
              </ul>
            </section>
          )}

          {SLOTS.map((slot) => {
            const options = itemsForSlot(items, slot)
            const current = equipped[slot] ?? null
            return (
              <section key={slot} className="ek-slot">
                <h2>{SLOT_LABELS[slot].name}</h2>
                <p className="ek-slot__where">{SLOT_LABELS[slot].where}</p>
                {options.length === 0 ? (
                  <p className="ek-muted">Nothing you own goes here.</p>
                ) : (
                  <ul className="ek-slot__options">
                    {/*
                      "None" is a real option and is a WRITE, not an omission: itemUrn null clears
                      the slot (`emberkin/src/server.ts` requires null explicitly, never
                      undefined). Rendering it as a radio makes the current state legible without
                      colour.
                    */}
                    <li>
                      <button
                        type="button"
                        className={`ek-slot__opt${current === null ? ' is-on' : ''}`}
                        aria-pressed={current === null}
                        disabled={busy !== null}
                        onClick={() => void apply(slot, null)}
                      >
                        None
                        {current === null ? <span className="ek-slot__mark"> · worn</span> : null}
                      </button>
                    </li>
                    {options.map((item) => (
                      <li key={item.itemUrn}>
                        <button
                          type="button"
                          className={`ek-slot__opt${current === item.itemUrn ? ' is-on' : ''}`}
                          aria-pressed={current === item.itemUrn}
                          disabled={busy !== null}
                          onClick={() => void apply(slot, item.itemUrn)}
                        >
                          <span className="ek-slot__name">{item.name}</span>
                          <span className="ek-slot__effect">{item.effect}</span>
                          {current === item.itemUrn ? <span className="ek-slot__mark"> · worn</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </>
      )}
    </section>
  )
}
