/**
 * The satchel: what you are carrying.
 *
 * Read-only, and the page says why. `inventory` is on the save (`emberkin/src/savegame.ts`) but
 * NOTHING writes it after creation: `POST /v1/saves` sets it once (`server.ts`), and the only
 * other writers are the battle route, which touches party/box/dexSeen (`battles.ts`), and
 * the cosmetics route, which touches equipped_cosmetics. There is no `PUT /v1/saves/me/inventory`.
 *
 * So items are consumed only inside a battle, by submitting an `item` script action
 * (`server.ts`) — and this screen's job is to tell the player what they have to spend there,
 * not to offer a "use" button that has nowhere to send the request.
 */
import { useGame } from '../lib/game.tsx'
import { Failed, Loading } from '../components/states.tsx'
import { CATEGORY_LABELS, categoryOf, itemEffect, itemName, type ItemCategory } from '../lib/items.ts'
import { chrome } from '../lib/art.ts'

const ORDER: readonly ItemCategory[] = ['resonator', 'healing', 'status', 'other']

export function SatchelPage() {
  const { save, reloadSave } = useGame()
  const glyph = chrome('glyph-satchel')

  if (save.status === 'loading') return <Loading label="Reading your save" />
  if (save.status === 'failed') {
    return <Failed notice={save.notice} title="Your save could not be read" onRetry={() => void reloadSave()} />
  }
  if (save.status === 'absent') {
    return (
      <section className="ek-page">
        <h1>Satchel</h1>
        <p>You have not started a game, so you are carrying nothing.</p>
      </section>
    )
  }

  const inventory = save.save.inventory
  const ids = Object.keys(inventory).filter((id) => (inventory[id] ?? 0) > 0)
  const grouped = new Map<ItemCategory, string[]>()
  for (const id of ids.sort()) {
    const category = categoryOf(id)
    const list = grouped.get(category)
    if (list) list.push(id)
    else grouped.set(category, [id])
  }

  return (
    <section className="ek-page">
      <header className="ek-page__head">
        {glyph ? <img src={glyph} alt="" aria-hidden="true" width={32} height={32} /> : null}
        <h1>Satchel</h1>
      </header>

      {ids.length === 0 ? (
        <p className="ek-empty">Nothing in your satchel.</p>
      ) : (
        ORDER.filter((category) => grouped.has(category)).map((category) => (
          <section key={category} className="ek-satchel__group">
            <h2>{CATEGORY_LABELS[category]}</h2>
            <ul className="ek-satchel">
              {(grouped.get(category) ?? []).map((id) => {
                const effect = itemEffect(id)
                return (
                  <li key={id} className="ek-satchel__item">
                    <span className="ek-satchel__name">{itemName(id)}</span>
                    <span className="ek-satchel__count cf-num">×{inventory[id]}</span>
                    <span className={`ek-satchel__effect${effect ? '' : ' ek-muted'}`}>
                      {effect ?? 'This build has no description for that one.'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <p className="ek-note">
        You use an item by picking it on a turn during a fight. Nothing outside a fight can change
        what is in here, so this screen gives you no buttons — they would have nowhere to send
        their request.
      </p>
    </section>
  )
}
