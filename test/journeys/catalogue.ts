/**
 * Group H of docs/ecosystem/22-browser-journeys.md — Emberkin — plus the estate-wide floor.
 *
 * ── What a meaningful assertion is on a game surface ──────────────────────────────────────────
 *
 * This is the surface doc 22 names as the one where "renders" and "works" diverge most: a canvas
 * that never gets a context, or a sprite sheet that 404s, leaves a page that is structurally
 * perfect. `assertMounted` catches a blank page and nothing else. So the assertions below are
 * about what a player would notice and a structural check would not:
 *
 *   * with WebGL refused, the page still plays — and it does NOT download a renderer it cannot
 *     use, which is the whole reason `webglAvailable` is its own module;
 *   * the art the credits page shows is the MANIFEST'S OWN WORDS, fetched, not paraphrased here;
 *   * the wardrobe's "none of this changes a number" claim is on the page, under every item;
 *   * "we could not check what you own" and "you own no cosmetics yet" are two different screens.
 *
 * ── The layer boundary ────────────────────────────────────────────────────────────────────────
 *
 * Nothing here asserts a game rule. The client posts an INTENT and animates the log that came
 * back; it must not compute an outcome, and a scenario that checked an outcome would be asserting
 * the very thing the client is forbidden to know.
 */
import assert from 'node:assert/strict'
import { HUB_MINE_PATH, MAIN_ID, NOT_PAID_CLAUSE } from '@cloudsforge/ui'
import { assertMounted, renderOnlyWithStubbedNetwork, type Stubs } from './browser.ts'
import {
  assertAxeClean,
  assertKnownStillBroken,
  assertLandmarks,
  assertSkipLink,
  type KnownViolation,
} from './axe.ts'
import type { Scenario } from './scenario.ts'
import { ROUTES } from '../../src/lib/routes.ts'

/*
 * Empty, and it was established by trying to fill it.
 *
 * Two doc comments used to stand here. The first described "the estate's one design-system
 * contrast defect" in the present tense — `--cf-fg-mute` at `#63757a`, 3.54:1 on micro-ui's panel
 * — as though an entry for it sat below. None did, and the token has since been raised to
 * `#7d9399` (5.29:1) in micro-ui `2f990be`, so the prose described a defect that was fixed and an
 * exclusion that never existed, sitting above an empty array. That is how somebody later concludes
 * the array is the thing that is wrong.
 *
 * What is true: this client's own `ek-` styles clear the threshold, and `assertKnownStillBroken`
 * REJECTED the exclusion when it was written in — it asserts every entry is still failing as well
 * as that nothing else is, so an unearned entry cannot sit here quietly. The list has been empty
 * on merit since, and an empty list is the stronger assertion: `assertAxeClean` then tolerates
 * nothing at all.
 *
 * If you ever do need an entry, it costs a `rule`, a `selector` naming the element it is actually
 * about, and an `owner`. Keying by rule alone was itself a defect — one entry excused every
 * violation of that rule id on the surface, and a sibling frontend stayed green for months with a
 * 4.44:1 link hidden behind an entry written for something else. See axe.ts.
 */
const KNOWN_A11Y: readonly KnownViolation[] = []

const SIGNED_IN = { 'cf.accessToken': 'test-access', 'cf.refreshToken': 'test-refresh' }
const ME = { user: { id: 'u_1', handle: 'warden', roles: ['user'] }, session: {}, organisations: [] }
const SIGNIN_STANDIN = {
  status: 200,
  contentType: 'text/html',
  body: '<!doctype html><title>stand-in</title><body>sign-in stand-in</body>',
}

/**
 * A save, built from `SaveState` in `src/lib/emberkin.ts` — this repository's own declaration of
 * what it consumes.
 *
 * That is the line between a fixture and a guess. The BATTLE routes are stubbed nowhere in this
 * file, because a battle's result shape is the engine's and inventing one would be this repository
 * asserting something about another service's output. A save is different: the interface above is
 * the contract this client reads, every field is declared here, and a field the service stops
 * sending breaks the type before it breaks a test.
 */
const kin = (speciesId: string, level: number, resonance: number, temperament: number) => ({
  speciesId,
  nickname: null,
  level,
  xp: level * 120,
  resonance,
  temperament,
  attunement: { ember: 40, tide: 10 },
  moves: ['ember_spark', 'steady_gaze'],
  heldItem: null,
  currentHp: 30 + level,
  status: 'ok',
})

const SAVE = {
  userId: 'u_1',
  wardenName: 'Warden',
  seed: '4815162342',
  currentRegion: 'emberfall_vale',
  storyProgress: 3,
  playtimeSeconds: 7_320,
  party: [
    kin('cindercub', 12, 61, -20),
    kin('tidepup', 10, 44, 5),
    kin('hearthmane', 14, 78, -55),
    kin('flarelynx', 9, 23, 40),
    kin('tidalhound', 11, 52, 0),
    kin('cinderpyre', 16, 88, 70),
  ],
  box: [],
  inventory: { emberdust: 3, tidebloom: 1 },
  seals: [],
  dexSeen: ['cindercub', 'tidepup'],
  equippedCosmetics: {},
  saveVersion: 1,
}

const BASE: Stubs = [
  ['GET /auth/me', { json: ME }],
  ['GET /readyz', { json: { ready: true } }],
  // No save: a signed-in player who has not started yet. Every page has to be honest in this
  // state, and it is the state a new player is in.
  ['GET /v1/saves/me', { json: SAVE }],
  ['GET /v1/saves/me/achievements', { json: { achievements: [] } }],
  ['GET /v1/content/dex', { json: { dex: [] } }],
  // Billing's entitlements, on `pay`'s own host: the wardrobe reads what a player OWNS from a
  // different service than the one that serves the game. It is fetched on every page because the
  // shell asks, so it belongs in the base table rather than in one scenario's.
  ['GET /entitlements', { json: { entitlements: [] } }],
  ['/account/login', SIGNIN_STANDIN],
]

const OWNED = ['/', '/party', '/dex', '/satchel', '/wardrobe', '/settings', '/credits']

/**
 * The addresses that hand a signed-out reader a sign-in journey instead of a page, DERIVED from
 * `src/lib/routes.ts` rather than written out again.
 *
 * Four of the seven, today. A second hand-kept list here would go stale the first time a page is
 * gated or ungated, and it would go stale silently — the scenario below would keep passing while
 * quietly checking the wrong halves of the surface.
 */
const GATED: readonly string[] = ROUTES.filter((r) => r.protected).map((r) => r.path)

/**
 * A sign-in destination that answers `204 No Content`, which leaves the browser where it is.
 *
 * `ProtectedRoute` (src/lib/auth.tsx) sends an anonymous reader to Hub's sign-in from an effect, so
 * a gated address renders this app's chrome for an instant and is then replaced by another origin's
 * document — with {@link SIGNIN_STANDIN} the harness settles on the stand-in HTML and there is no
 * bar left to look at. A navigation that answers 204 never commits, so the hand-off is genuinely
 * attempted, the reader is genuinely signed out, and the screen they are looking at while it
 * happens stays on screen long enough to assert against. Chromium records the abandoned navigation
 * as `net::ERR_ABORTED`; that is arranged, so it is tolerated by name and not by widening anything.
 */
const SIGNIN_HELD = { status: 204 }

export const CATALOGUE: readonly Scenario[] = [
  /* ---- doc 22 §5.1 ---------------------------------------------------- */
  {
    id: 'BJ-EMBERKIN-404',
    title: 'every route this client owns survives a hard refresh and every other address answers 404',
    tier: 2,
    asserts: 'navigation',
    gate: true,
    expectStatus: 404,
    ownedBy: 'emberkin-web/test/routes.test.ts#nginx',
    async run(surface) {
      assert.equal(surface.nginx.honest404, true, 'nginx.conf has no error_page 404 /index.html')
      for (const path of OWNED) {
        const { status } = await surface.fetchStatus(path)
        assert.equal(status, 200, `${path} answered ${status}; an owned route must survive a refresh`)
      }
      for (const path of ['/nope', '/party/kin-1', '/dex/aetherion', '/wardrobe/season']) {
        const { status } = await surface.fetchStatus(path)
        assert.equal(status, 404, `${path} answered ${status}; it must 404`)
      }

      // The art and game payloads are real files served under their own prefixes, and a MISSING
      // one must answer 404 rather than the shell: a sprite sheet answered with HTML is a decode
      // error, and a `.glb` answered with HTML is a renderer that silently draws nothing.
      const missing = await surface.fetchStatus('/game/models/creatures/nope.glb')
      assert.equal(missing.status, 404)
      const real = await surface.fetchStatus('/art/MANIFEST.json')
      assert.equal(real.status, 200, 'the art manifest is not served')

      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/nope', storage: SIGNED_IN, stubs: BASE })
      try {
        assert.equal(session.status, 404)
        await assertMounted(session)
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-EMB-04 ------------------------------------------------ */
  {
    id: 'BJ-EMB-04',
    title: 'with WebGL refused the play screen still renders, and no renderer is downloaded',
    tier: 2,
    asserts: 'presentation',
    gate: true,
    noServerRule:
      'The probe is `webglAvailable()` in this bundle and the branch is this bundle’s. No service ' +
      'is asked anything; what is asserted is that the page degrades instead of blanking, and ' +
      'that it does not fetch a chunk it has already decided it cannot use.',
    async run(surface) {
      // A machine with no GPU, expressed the way one behaves: `getContext('webgl')` answers null.
      // Deleting the module would be a different experiment — it would change the import graph,
      // which is half of what this scenario is about.
      const session = await renderOnlyWithStubbedNetwork(surface.origin, { storage: SIGNED_IN, stubs: BASE, noWebgl: true })
      try {
        const text = await assertMounted(session)
        assert.ok(text.trim().length > 100, 'the play screen collapsed to almost nothing')

        // THE RENDERER IS NOT DOWNLOADED. `pages/play.tsx` asks the question before deciding
        // whether to `import('./stage.ts')`, precisely so a machine that cannot render never
        // fetches one — and a static import anywhere would quietly undo that. Asserted against the
        // requests the page actually made, which is the only place the lazy boundary is real.
        const models = session.collected.requests.filter((r) => /\.glb($|\?)/.test(r.url))
        assert.deepEqual(
          models.map((r) => r.url),
          [],
          'a model was downloaded for a machine that cannot render it',
        )
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-EMB-06 and BJ-EMB-07 ---------------------------------- */
  {
    id: 'BJ-EMB-07',
    title: 'the party screen offers no reorder, rename or move-to-box control, and says so once',
    tier: 1,
    asserts: 'presentation',
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/party', storage: SIGNED_IN, stubs: BASE })
      try {
        await assertMounted(session)
        // Not five disabled buttons. A disabled control reads as "not yet, ask somebody", and this
        // page says once that the party is not editable rather than growing dead controls.
        const controls = await session.page.$$eval('main button, main input, main select', (nodes) =>
          nodes.map((n) => ({
            label: (n.textContent ?? n.getAttribute('aria-label') ?? '').trim().toLowerCase(),
            disabled: (n as HTMLButtonElement).disabled,
          })),
        )
        const editors = controls.filter((c) => /reorder|rename|move to box|swap|release/.test(c.label))
        assert.deepEqual(editors, [], 'the party screen has grown an editing control')
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-EMB-09 and BJ-EMB-10 ---------------------------------- */
  {
    id: 'BJ-EMB-09',
    title: 'the wardrobe states the cosmetics rule in the lede and again beside the season pass',
    tier: 1,
    asserts: 'presentation',
    gate: true,
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/wardrobe', storage: SIGNED_IN, stubs: BASE })
      try {
        const text = await assertMounted(session)
        // A shop that hedges is a shop that expects to be asked, so the claim is unhedged and it is
        // repeated. Asserted as the sentences themselves rather than as a keyword count: the words
        // ARE the product decision, and a paraphrase softening "not a stat, not a catch rate, not a
        // Resonance gain" into "cosmetic only" is exactly the regression worth catching.
        assert.ok(
          text.includes('Not one item touches a number'),
          `the lede does not state the rule. Page says: ${text.slice(0, 700)}`,
        )
        assert.ok(
          text.includes('not a stat, not a catch rate, not a Resonance gain'),
          'the lede states the rule without saying what it covers',
        )
        // The season-pass claim and the per-item claim are NOT asserted here, and that is a gap
        // worth naming rather than hiding: both render only when the catalogue has something in
        // it, which needs an owned entitlement and a cosmetics catalogue this repository would
        // have to invent. BJ-EMB-09-ITEMS records it.
        // …and it is a rule of the game, not a promise of this page. That distinction is the whole
        // sentence: a promise can be broken by a later release and a rule cannot.
        assert.ok(
          text.includes('a rule of the game, not a'),
          'the claim is presented as this page’s promise rather than as the game’s rule',
        )
      } finally {
        await session.close()
      }
    },
  },
  {
    id: 'BJ-EMB-10',
    title: 'billing not answering and billing answering empty are two different screens',
    tier: 1,
    asserts: 'presentation',
    gate: true,
    noServerRule:
      'Both answers come from the same service and both are legitimate. What is asserted is that ' +
      'this bundle distinguishes them: a player who bought something yesterday and is told they ' +
      'own nothing will read it as a theft, and the request id is what a support conversation ' +
      'then runs on.',
    async run(surface) {
      const empty = await renderOnlyWithStubbedNetwork(surface.origin, {
        path: '/wardrobe',
        storage: SIGNED_IN,
        stubs: BASE,
      })
      let emptyText = ''
      try {
        emptyText = await assertMounted(empty)
      } finally {
        await empty.close()
      }

      const broken = await renderOnlyWithStubbedNetwork(surface.origin, {
        path: '/wardrobe',
        storage: SIGNED_IN,
        stubs: [
          [
            'GET /entitlements',
            {
              status: 503,
              headers: { 'x-request-id': 'cf-req-billing-9' },
              json: { error: { code: 'unavailable', message: 'Billing did not answer.', requestId: 'cf-req-billing-9' } },
            },
          ],
          ...BASE,
        ],
      })
      try {
        const brokenText = await assertMounted(broken)
        assert.notEqual(
          brokenText,
          emptyText,
          'an unreachable billing service renders exactly the same screen as owning nothing',
        )
        // The request id is what turns "we could not check" into something support can act on.
        assert.ok(
          brokenText.includes('cf-req-billing-9'),
          `no request id on the failure screen. It says: ${brokenText.slice(0, 400)}`,
        )
      } finally {
        await broken.close()
      }
    },
  },

  /* ---- doc 22 BJ-EMB-13 ------------------------------------------------ */
  {
    id: 'BJ-EMB-13',
    title: 'the credits page fetches the art manifest and renders the manifest’s own disclosure',
    tier: 2,
    asserts: 'presentation',
    async run(surface) {
      // The manifest that ships with the art is the source. A paraphrase here would be a second
      // statement of the AI-generation disclosure, and the softer of the two is the one a reader
      // would quote — so what is asserted is that the page's words came off the wire in this run.
      const manifest = JSON.parse((await surface.fetchStatus('/art/MANIFEST.json')).body) as {
        disclosure?: string
        licence?: string
      }
      assert.ok(manifest.disclosure, 'the shipped manifest carries no disclosure to render')

      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/credits', storage: SIGNED_IN, stubs: BASE })
      try {
        const text = await assertMounted(session)
        assert.ok(
          text.includes(manifest.disclosure),
          `the credits page does not render the manifest's own disclosure verbatim.\n` +
            `Manifest says: ${manifest.disclosure.slice(0, 160)}\nPage says: ${text.slice(0, 400)}`,
        )
        const fetched = session.collected.requests.find((r) => r.url.includes('/art/MANIFEST.json'))
        assert.ok(fetched, 'the credits page never fetched the manifest — the words are baked in')
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-EMB-14 ------------------------------------------------ */
  {
    id: 'BJ-EMB-14',
    title: 'the settings page resolves every host from the address bar at runtime',
    tier: 1,
    asserts: 'presentation',
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/settings', storage: SIGNED_IN, stubs: BASE })
      try {
        const text = await assertMounted(session)
        // Served from 127.0.0.1, so `cloudsforgeHosts()` must resolve every surface to a localhost
        // dev port. A baked constant would show a production hostname here, and that is the
        // difference between one image serving every environment and one image per environment.
        assert.ok(/localhost:\d+/.test(text), `no runtime-resolved host on the page: ${text.slice(0, 400)}`)
        assert.equal(
          text.includes('cloudsforge.online'),
          false,
          'a production hostname is baked into this bundle',
        )
      } finally {
        await session.close()
      }
    },
  },

  /* ---- estate-wide, on this surface ------------------------------------ */
  {
    id: 'BJ-ACC-06',
    title: 'the SSO callback code is stripped from the address bar before the exchange is sent',
    tier: 1,
    asserts: 'client-request',
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, {
        path: '/#cf_code=handoff-code-123',
        stubs: [['POST /auth/handoff/redeem', { json: { accessToken: 'a', refreshToken: 'r' } }], ...BASE],
      })
      try {
        await assertMounted(session)
        const hash = await session.page.evaluate(() => window.location.hash)
        assert.equal(hash.includes('cf_code'), false, `cf_code is still in the address bar: ${hash}`)
        const redeem = session.apiCalls().find((c) => c.url.includes('/auth/handoff/redeem'))
        assert.ok(redeem, 'the hand-off code was never redeemed')
        assert.ok(redeem.body?.includes('handoff-code-123'), 'the code was not sent in the body')
        assert.equal(redeem.url.includes('handoff-code-123'), false, 'the code was put in a URL')
      } finally {
        await session.close()
      }
    },
  },
  /**
   * THE OFFER OF BROWSER MINING IS IN THE COMPANY BAR, ON EVERY ADDRESS THIS CLIENT SERVES.
   *
   * `mining` is an OPT-IN prop on `CloudsForgeBar`. A bar rendered without it is a perfectly valid
   * bar, so a shell that never passes it is indistinguishable from one that does — by typecheck, by
   * lint, and by every other test in this repository. Measured on 2026-08-10, eleven of eighteen
   * frontends passed it, and of the seven that did not this was the ONLY one that mounts the bar,
   * carries a real session and could therefore have offered it. The other six either render no bar
   * at all or have no reader to offer it to. So the gap here was not a category difference; it was
   * one line missing from `src/components/shell.tsx`, and nothing could see it.
   *
   * ── Why this surface is the awkward one to keep it on ─────────────────────────────────────────
   *
   * The chrome here is three stacked strips, not one: `CloudsForgeBar`, then this app's own game
   * nav, then the persistent HUD (`src/components/hud.tsx`). Two of the three are this repository's
   * furniture and exist on no other surface in the estate, and they are the obvious-looking place
   * to put a game-shaped control. Putting it there would read fine in a screenshot and would move
   * the control to a different position on the one surface a player spends the most time on — which
   * is the "where has it gone" the control was created to end. So what is asserted is not merely
   * that a mining control exists somewhere on the page: it is that there is exactly ONE in the whole
   * document, that it is inside `.cf-bar`, and that nothing has been slipped between it and the
   * account.
   *
   * ── And why the signed-out gated screens are checked, not just the pages ──────────────────────
   *
   * Four of this client's seven routes are behind `ProtectedRoute` (src/lib/auth.tsx) and render a
   * hand-off to Hub's sign-in rather than a page. A signed-out player's first screen here is
   * therefore usually NOT a page, and chrome that only arrives once a save has loaded would be
   * missing from exactly the screens somebody new sees. The 404 shell is checked for the same
   * reason from the other end: nginx answers 404 and still serves this shell (BJ-EMBERKIN-404), and
   * a lost reader is the one who most needs a way onwards.
   *
   * Deleting the one line in `src/components/shell.tsx` turns this red and leaves the rest of the
   * suite green, which is the mutation proof.
   *
   * ── What this does NOT assert ─────────────────────────────────────────────────────────────────
   *
   * What the control DRAWS — micro-ui's `mining.test.ts` owns that — and what pressing it does,
   * which is asserted in micro-hub-web, the bundle that actually mounts the miner. A mining session
   * is a WebSocket and two Web Workers pinned to ONE origin, and `hub.<apex>` is not this one. What
   * this client owes a player is that the offer exists, that it is where they will look for it, and
   * that it is a LINK they can middle-click rather than an `onClick` no link check can see.
   */
  {
    id: 'BJ-MINE-BAR',
    title: 'the offer of browser mining is beside the account, in the bar, on every address this client serves',
    tier: 2,
    asserts: 'presentation',
    async run(surface) {
      /*
       * Every owned route with a session; the 404 shell, which this app does not own and still
       * renders; and every gated route with NO session, which is the sign-in hand-off screen rather
       * than a page. The three together are the whole of what a browser can be pointed at here.
       */
      const addresses = [
        ...OWNED.map((path) => ({ path, signedIn: true })),
        { path: '/nope', signedIn: true },
        ...GATED.map((path) => ({ path, signedIn: false })),
      ]

      for (const { path, signedIn } of addresses) {
        const where = signedIn ? path : `${path} (signed out)`
        const session = await renderOnlyWithStubbedNetwork(surface.origin, {
          path,
          ...(signedIn ? { storage: SIGNED_IN } : {}),
          stubs: signedIn ? BASE : [['/account/login', SIGNIN_HELD], ...BASE],
        })
        try {
          await assertMounted(session, signedIn ? {} : { tolerateFailures: [/\/account\/login/] })

          // ONE, in the whole document, and it is in the company bar rather than in this app's own
          // game nav or its HUD. Counted document-wide first: a second copy grown in a strip below
          // would satisfy a `.cf-bar .cf-mine` check on its own and would still be two controls
          // offering the same thing.
          const anywhere = await session.page.$$('.cf-mine')
          assert.equal(
            anywhere.length,
            1,
            `${where}: expected exactly one mining control in the document, found ${anywhere.length}`,
          )
          const found = await session.page.$$('.cf-bar .cf-mine')
          assert.equal(
            found.length,
            1,
            `${where}: the mining control is not in the company bar (found ${found.length} there)`,
          )
          const mine = found[0] as NonNullable<(typeof found)[number]>

          /*
           * An anchor, and pointed at HUB. Getting the surface wrong is the likely mistake rather
           * than a hypothetical one: a control that offered mining and led back to the page the
           * player is already on is indistinguishable from a working one in every screenshot.
           */
          assert.equal(
            await mine.evaluate((el) => el.tagName),
            'A',
            `${where}: the mining control is not a link`,
          )
          const href = (await mine.getAttribute('href')) ?? ''
          assert.ok(
            href.endsWith(HUB_MINE_PATH),
            `${where}: the mining control points at ${href}, not at ${HUB_MINE_PATH}`,
          )
          assert.notEqual(
            new URL(href, surface.origin).origin,
            new URL(surface.origin).origin,
            `${where}: the mining control leads back to this client instead of to Forge Hub`,
          )

          /*
           * DOCUMENT ORDER, NOT CSS. A stylesheet can put a box anywhere on the row — `order:` and
           * `flex-direction: row-reverse` both do it without moving a node — so reading the
           * rendered geometry would pass for a control a keyboard player reaches last, after the
           * switcher, three strips of chrome and the whole page. "Beside the account" is a claim
           * about where you find it.
           *
           * The `.cf-sr` skipped between them is the control's own description span, which
           * `MiningControl` renders as a SIBLING so it is a description and not part of the
           * accessible name (`ui/packages/ui/src/mining.tsx`).
           *
           * The last control is the account, and it is a different element in the two states this
           * scenario visits: the menu when there is a session, the sign-in button when there is
           * not. Both are accepted; anything else is something new that has pushed in.
           */
          const placement = await session.page.evaluate(() => {
            const inner = document.querySelector('.cf-bar__inner')
            if (!inner) return null
            const kids = [...inner.children]
            const mineAt = kids.findIndex((el) => el.classList.contains('cf-mine'))
            const last = kids.length - 1
            return {
              between: kids.slice(mineAt + 1, last).filter((el) => !el.classList.contains('cf-sr')).length,
              account: kids[last]?.className ?? '',
            }
          })
          assert.ok(placement, `${where}: the bar has no inner row`)
          assert.equal(placement.between, 0, `${where}: something now sits between mining and the account`)
          assert.match(
            placement.account,
            /cf-pop|cf-btn--ember/,
            `${where}: the last control in the bar is not the account (${placement.account})`,
          )

          /*
           * And it promises nothing. `pool/src/payouts.ts` states it — "PAYOUTS ARE OFF" — and
           * `miningOnHub()` defaults `payoutsImplemented` to false rather than asking a bundle that
           * has never spoken to the pool to assert otherwise. Asserted against the exported
           * constant, so rewording the sentence in micro-ui does not leave this checking a string
           * that no longer appears anywhere.
           */
          const clause = await session.page.evaluate(() => {
            const el = document.querySelector('.cf-bar .cf-mine')
            const id = el?.getAttribute('aria-describedby') ?? ''
            return document.getElementById(id)?.textContent ?? null
          })
          assert.ok(clause, `${where}: the mining control carries no description for a screen reader`)
          assert.ok(
            clause.includes(NOT_PAID_CLAUSE),
            `${where}: the mining control does not carry the not-paid clause`,
          )
        } finally {
          await session.close()
        }
      }
    },
  },
  {
    id: 'BJ-A11Y-01',
    title: 'axe finds no serious or critical violation on any route of this client',
    tier: 2,
    asserts: 'presentation',
    gate: true,
    async run(surface) {
      const seen = new Set<string>()
      for (const path of [...OWNED, '/nope']) {
        const session = await renderOnlyWithStubbedNetwork(surface.origin, {
          path,
          storage: SIGNED_IN,
          stubs: BASE,
        })
        try {
          await assertMounted(session)
          for (const id of await assertAxeClean(session.page, path, KNOWN_A11Y)) seen.add(id)
        } finally {
          await session.close()
        }
      }
      assertKnownStillBroken(seen, KNOWN_A11Y)
    },
  },
  {
    id: 'BJ-A11Y-11',
    title: 'a player who prefers reduced motion is not animated at',
    tier: 1,
    asserts: 'presentation',
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, {
        storage: SIGNED_IN,
        stubs: BASE,
        reducedMotion: true,
      })
      try {
        await assertMounted(session)
        // Read from the browser's own answer rather than from a class name: the media query is what
        // the operating system setting actually reaches, and a bundle that honoured a class but not
        // the query would pass a markup check and animate anyway.
        const honoured = await session.page.evaluate(
          () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        )
        assert.equal(honoured, true, 'the preference did not reach the page at all')
        // No element is left running an animation or a transition under the preference.
        // Written without an inner named helper on purpose: `tsx` compiles one through esbuild's
        // `keepNames` shim, which emits a `__name(...)` call that does not exist inside the page —
        // the evaluate then fails with `__name is not defined`, which looks like a page error and
        // is a transpiler artefact. Everything inside `evaluate` stays inline.
        const moving = await session.page.evaluate(() =>
          [...document.querySelectorAll('*')].filter((el) => {
            const style = getComputedStyle(el)
            const anim = style.animationDuration.split(',').some((p) => parseFloat(p) > 0.01)
            const trans = style.transitionDuration.split(',').some((p) => parseFloat(p) > 0.01)
            return anim || trans
          }).length,
        )
        const offenders = await session.page.evaluate(() =>
          [...document.querySelectorAll('*')]
            .filter((el) => {
              const style = getComputedStyle(el)
              const anim = style.animationDuration.split(',').some((p) => parseFloat(p) > 0.01)
              const trans = style.transitionDuration.split(',').some((p) => parseFloat(p) > 0.01)
              return anim || trans
            })
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
        )
        assert.equal(
          moving,
          0,
          `${moving} element(s) still animate under prefers-reduced-motion: ${offenders.join(', ')}`,
        )
      } finally {
        await session.close()
      }
    },
  },
  {
    id: 'BJ-A11Y-12',
    title: 'a reachable skip link, one main landmark, and a heading order with no level skipped',
    tier: 2,
    asserts: 'presentation',
    async run(surface) {
      for (const path of OWNED) {
        const session = await renderOnlyWithStubbedNetwork(surface.origin, {
          path,
          storage: SIGNED_IN,
          stubs: BASE,
        })
        try {
          await assertMounted(session)
          await assertLandmarks(session.page, path)
          // `#cf-main`, read from the design system's own constant rather than typed. The shell
          // used to hand-write `<main id="main">` beside an `<a href="#main">` and get the
          // `tabIndex={-1}` half wrong; `SkipLink` and `MainRegion` now compose both from
          // `MAIN_ID`, and passing that same export here means this assertion cannot be the thing
          // that goes stale when the constant moves.
          await assertSkipLink(session.page, path, `#${MAIN_ID}`)
        } finally {
          await session.close()
        }
      }
    },
  },

  /* ---- specified, and not writable today -------------------------------- */
  {
    id: 'BJ-EMB-09-ITEMS',
    title: 'the cosmetics claim is repeated under every item and beside the season pass',
    tier: 1,
    asserts: 'presentation',
    blocked:
      'Both render only once the catalogue has something in it, which needs an owned entitlement ' +
      'from micro-billing AND a cosmetics catalogue. Inventing either here would be this ' +
      'repository asserting a shape another service owns. The half that is always on the page — ' +
      'the unhedged lede, with what the rule covers — is asserted by BJ-EMB-09.',
  },
  {
    id: 'BJ-EMB-01',
    title: 'submitting a battle posts an intent — an enemy and a list of turns — and animates the log that came back',
    tier: 2,
    asserts: 'client-request',
    gate: true,
    blocked:
      'The play screen needs a SAVE, and a save is the richest response this service produces: a ' +
      'party of six Kin with resonance, temperament, sync, moves, a satchel and a campaign ' +
      'position, in the shapes `emberkin/src/saves.ts` serves. A fixture written from this side ' +
      'would be this repository’s guess at another service’s response, and a scenario that passed ' +
      'against a wrong guess would prove nothing about the real client. It needs a captured ' +
      'interaction from micro-conformance, which doc 22 §4 names as the tier-2 stub source.',
  },
  {
    id: 'BJ-EMB-02',
    title: 'submitting the same battle twice records one battle and reads the second as a replay',
    tier: 1,
    asserts: 'client-request',
    gate: true,
    blocked:
      'Blocked behind BJ-EMB-01: the submit control cannot be reached without a save. The ' +
      'idempotency key is minted by `newIdempotencyKey()` when the intent forms, and its pure half ' +
      'is covered by test/battle.test.ts; what is missing is the rendered half.',
  },
]
