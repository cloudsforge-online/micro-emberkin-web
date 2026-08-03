/**
 * The harness must keep saying what it actually does.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THIS FILE GUARDS A NAME, AND A NAME IS WHAT COST THE ESTATE A NIGHT.
 *
 * `test/journeys/browser.ts` renders this bundle against a fake network: it installs
 * `page.route('**\/*', …)` and answers every request from a fixture. Under its original name —
 * `open()` — a reader had no way to tell that from a helper that opens the product. So 314
 * specified browser scenarios and a green CI coexisted with three completely unstyled surfaces,
 * four whose reads 404'd or 401'd in a browser, and a degradation banner shown to every visitor
 * of a healthy game. Nothing was lying except the name.
 *
 * The rename is only durable if reverting it is loud. So this asserts three things:
 *
 *   1. the entry point is still called `renderOnlyWithStubbedNetwork` — a name that cannot be
 *      read as "this opens the product";
 *   2. it still says, in words, that it cannot detect an unreachable API, a wrong host or an
 *      unrouted path — because a truthful name over a header that no longer explains it is half
 *      the guard;
 *   3. it still names the tier that CAN — `micro-beacon`'s smoke tier — because a warning that
 *      does not say where to go next gets read as an excuse rather than a signpost.
 *
 * And the fourth, which is the reason the other three matter: the file must STILL contain the
 * interception. If `page.route` ever disappears from it, this file is guarding a warning about a
 * thing that no longer happens, and the warning has become noise that the next reader will
 * correctly delete.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const HARNESS = fileURLToPath(new URL('./journeys/browser.ts', import.meta.url))
const SOURCE = readFileSync(HARNESS, 'utf8')

/** The header with its comment markers gone, so a quoted phrase is still readable text. */
const PROSE = SOURCE.replace(/^\s*\*\/?/gm, ' ')

describe('the stubbing harness states what it does', () => {
  it('still intercepts every request — otherwise this whole file is guarding nothing', () => {
    // Deliberately assembled rather than written out, so this assertion does not match its own
    // explanation in the header above.
    const intercept = ['page', '.route('].join('')
    assert.ok(
      SOURCE.includes(intercept),
      'the harness no longer intercepts requests; if that is true the warnings it carries are ' +
        'stale and this guard should be deleted along with them, deliberately',
    )
  })

  it('the entry point is named for what it does, not for what a reader hopes it does', () => {
    assert.ok(
      SOURCE.includes('export async function renderOnlyWithStubbedNetwork('),
      'the stubbing entry point has been renamed. A name like `open()` invites the next reader ' +
        'to trust these scenarios for reachability, which they structurally cannot answer',
    )
    // The old name must not come back as an alias either — an `export { … as open }` would undo
    // this while leaving the declaration above intact.
    assert.doesNotMatch(
      SOURCE,
      /\bas open\b|export async function open\(|export const open\b/,
      'the old name is exported again, so callers can still read as though they opened the product',
    )
  })

  it('says plainly what it cannot see', () => {
    for (const phrase of ['unreachable API', 'wrong host', 'unrouted path']) {
      assert.ok(
        PROSE.includes(phrase),
        `the harness header no longer says it cannot detect an ${phrase}`,
      )
    }
  })

  it('names the tier that CAN see those things', () => {
    assert.ok(
      PROSE.includes('micro-beacon') && PROSE.includes('smoke'),
      'the harness header no longer names micro-beacon’s smoke tier, so a reader who learns ' +
        'these scenarios cannot answer reachability is not told what does',
    )
  })
})
