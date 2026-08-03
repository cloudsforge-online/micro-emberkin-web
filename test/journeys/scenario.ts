/**
 * A browser scenario, as doc 22 defines one, and the meta-test that keeps the layer boundary.
 *
 * ── The rule this file exists to enforce ──────────────────────────────────────────────────────
 *
 * A BROWSER SCENARIO MAY NEVER ASSERT A BUSINESS RULE. The reason is a recorded incident
 * (docs/ecosystem/14-testing-strategy.md §11): a game client withheld four SKUs from its UI while
 * the payment routes stayed live and chargeable. A client-side test asserting "the four SKUs are
 * not shown" would have passed, green, against the defect — because hiding them WAS the entire
 * control.
 *
 * Advice does not survive a deadline, so the boundary is two declared fields and a test over them
 * (doc 22 §3.2):
 *
 *   `asserts`  — exactly one of `presentation`, `client-request`, `navigation`. There is no
 *                `absence`: a scenario that would assert something is NOT on screen must instead
 *                assert the positive fact ("the page shows exactly what the API returned") or it
 *                is not a browser scenario at all.
 *   `ownedBy`  — required whenever the outcome depends on a server-side rule. Not a description;
 *                a path, resolvable by grep, in the service that enforces the rule.
 *
 * `checkCatalogue` below refuses to pass rather than reporting green, which is the same shape as
 * beacon's rule that a declared-but-faked journey is worse than no journey.
 *
 * ── THE ASSERTION SHAPE TO WATCH FOR, WHICH NO META-TEST CAN CATCH ────────────────────────────
 *
 * A SELF-REFERENTIAL ASSERTION: comparing the rendered page against the same module the page
 * renders FROM.
 *
 *     import { PLATFORM } from '../../src/content/pages.ts'
 *     assert.ok(text.includes(PLATFORM.tests[0]))     // ← rewrite pages.ts and both sides move
 *
 * It is green for any value, which makes it the same defect as `ui/packages/ui/src/auth.test.ts`
 * asserting the client posts to the URL the client was written to post to — the test that let
 * `/auth/exchange`, a route micro-identity has never served, live in thirteen frontends.
 *
 * It is not always wrong. Comparing the page against an imported constant proves the page is WIRED
 * to it — that the list is complete, in order, not truncated — and that is worth having. What it
 * cannot prove is that the words still say what they said. So wherever the WORDS are the product
 * decision, write one literal into the test as well:
 *
 *     assert.ok(callout.includes('Nothing is deployed'))
 *
 * Two rules learned from doing it badly first:
 *
 *   1. SCOPE THE LITERAL TO THE ELEMENT, not the page. `micro-site`'s first anchor searched the
 *      whole body for "Nothing is deployed", and the phrase also appears in two product stage
 *      notes further down — so softening the headline left it green. A literal in the wrong scope
 *      is a self-referential assertion with extra steps.
 *   2. PROVE IT. Reword the copy, watch the test go red, put the copy back. An anchor nobody has
 *      seen fail is an anchor nobody knows works.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it, after } from 'node:test'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { closeBrowser } from './browser.ts'
import { startSurface, stopSurface, type Surface } from './surface.ts'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
/** The estate root, when the sibling repositories happen to be checked out beside this one. */
const ESTATE = fileURLToPath(new URL('../../../', import.meta.url))

export type Asserts = 'presentation' | 'client-request' | 'navigation'

export interface Scenario {
  /** Stable, and never renumbered: a renamed scenario abandons its metric history (doc 22 §6.0). */
  readonly id: string
  readonly title: string
  /** T1 needs nothing but the bundle and stubs; T2 needs the bundle behind its own nginx.conf. */
  readonly tier: 1 | 2
  readonly asserts: Asserts
  /** ★ — a release candidate does not promote until this is green. */
  readonly gate?: boolean
  /**
   * Name the server-side rule this scenario's outcome depends on. Setting it makes `ownedBy`
   * mandatory. Leave it unset when the scenario asserts only what the client rendered or sent.
   */
  readonly serverRule?: string
  /** Path of the server-side test that owns the rule, relative to the estate root. */
  readonly ownedBy?: string
  /**
   * Why this scenario turns on no server rule at all, when its title reads as though it might.
   *
   * The refusal check below is deliberately blunt — it matches a word, in a title. That makes it
   * fire on a scenario about a page whose SUBJECT is refusals ("the company's published
   * refusals") as readily as on one asserting an HTTP 403. Silently narrowing the pattern until
   * it stops complaining is how a guard loses its teeth; a bypass nobody has to justify is how it
   * loses them faster. So the third answer is a sentence, written by the author, saying what the
   * scenario actually asserts. It costs one line and it is readable in review.
   */
  readonly noServerRule?: string
  /** For `navigation`: the HTTP status the address must answer under. */
  readonly expectStatus?: number
  /** ⛔ — why this scenario cannot be written as code today. A specification, not coverage. */
  readonly blocked?: string
  /**
   * The blocker, expressed as something a machine can check, so it cannot go stale.
   *
   * ── Why prose alone is not enough ─────────────────────────────────────────────────────────────
   *
   * A `blocked` reason is a claim about the estate written at one moment. The estate then moves.
   * This suite shipped with `BJ-ACC-01` blocked on "nothing in the estate serves a sign-in page",
   * which was true when it was written and was false within days: `micro-hub-web` now serves
   * `/account/login`, `/account/register` and `/account/logout`. Nothing went red. A gap that has
   * quietly closed reads exactly like a gap that is still open, and the scenario stays unwritten
   * for no reason anybody can see — which is the same defect as a test that cannot fail, wearing
   * a different hat.
   *
   * So a blocker names a FILE and a string, relative to the estate root, and `runCatalogue`
   * asserts the premise still holds wherever the sibling is on disk:
   *
   *   `{ absent: 'hub-web/src/app.tsx#account/login' }`  — blocked BECAUSE this is missing.
   *   `{ present: 'deploy/compose/docker-compose.estate.yml#no frontend' }` — blocked because
   *     this is still there.
   *
   * When the estate closes the gap, this goes red and says which scenario is now writable. That is
   * the only mechanism that makes "specified rather than omitted" mean anything a month later.
   *
   * Omit it only when the blocker is genuinely not a fact about a file — "this needs two live
   * origins" — and say so in `blocked`.
   */
  readonly blockedWhile?: { readonly absent?: string; readonly present?: string }
  readonly run?: (surface: Surface) => Promise<void>
}

/**
 * The vocabulary of a scenario that turns on somebody else's decision.
 *
 * A title containing one of these describes an outcome the SERVER produces, so the scenario either
 * names the test that owns it or says explicitly that it asserts only the sentence the user is
 * shown (doc 22 §3.4). Matched against the title alone — short, authored text — and never against
 * the surrounding prose, because six guards in this estate have already been found firing on their
 * own written-down rationale.
 */
const REFUSAL = /\b(refus\w*|denied|deny|forbidden|403|401|rejected|not permitted|unauthorised)\b/i

interface Finding {
  readonly id: string
  readonly problem: string
}

export function checkCatalogue(scenarios: readonly Scenario[]): Finding[] {
  const findings: Finding[] = []
  const seen = new Set<string>()

  for (const s of scenarios) {
    if (!/^BJ-[A-Z0-9]+(-[A-Z0-9]+)*$/.test(s.id)) findings.push({ id: s.id, problem: 'id is not a BJ- identifier' })
    if (seen.has(s.id)) findings.push({ id: s.id, problem: 'duplicate id' })
    seen.add(s.id)

    if (s.title.trim().length < 12) findings.push({ id: s.id, problem: 'title says nothing' })

    if (s.blocked) {
      if (s.run) findings.push({ id: s.id, problem: 'is blocked and yet carries an implementation' })
      if (s.blocked.trim().length < 20) {
        findings.push({ id: s.id, problem: 'is blocked without saying what the blocker is' })
      }
      const where = s.blockedWhile
      if (where && !where.absent && !where.present) {
        findings.push({ id: s.id, problem: 'blockedWhile names neither an absent nor a present anchor' })
      }
      for (const anchor of [where?.absent, where?.present]) {
        if (anchor && !/^[\w.-]+\/[^\s#]+#.+$/.test(anchor)) {
          findings.push({ id: s.id, problem: `blockedWhile "${anchor}" is not a <repo>/<path>#<string>` })
        }
      }
      continue
    }
    if (!s.run) findings.push({ id: s.id, problem: 'has no implementation and is not marked blocked' })

    if (s.serverRule && !s.ownedBy) {
      findings.push({ id: s.id, problem: `depends on the server rule "${s.serverRule}" and names no ownedBy` })
    }
    if (s.asserts === 'navigation' && s.expectStatus === undefined) {
      findings.push({ id: s.id, problem: 'asserts navigation without declaring the status it expects' })
    }
    if (
      s.asserts === 'navigation' &&
      s.expectStatus !== undefined &&
      (s.expectStatus < 200 || s.expectStatus > 299) &&
      !s.ownedBy
    ) {
      findings.push({ id: s.id, problem: `expects HTTP ${s.expectStatus} and names no ownedBy` })
    }
    if (REFUSAL.test(s.title) && !s.ownedBy && !s.serverRule && !s.noServerRule) {
      findings.push({
        id: s.id,
        problem:
          'the title describes a refusal. Name the server test that owns it in ownedBy, rewrite ' +
          'the title to describe the sentence the user is shown, or say in noServerRule why no ' +
          'server rule is involved',
      })
    }
    if (s.noServerRule && s.noServerRule.trim().length < 30) {
      findings.push({ id: s.id, problem: 'noServerRule is a shrug rather than a reason' })
    }
    if (s.noServerRule && (s.ownedBy || s.serverRule)) {
      findings.push({ id: s.id, problem: 'claims both that a server rule owns it and that none does' })
    }
    // `<repo>/<path>` with an optional `#<anchor>` — a string `grep` can resolve, never a
    // description. The anchor is the line the rule is stated on, so a moved test is caught too.
    if (s.ownedBy && !/^[\w.-]+\/[^\s#]+(#.+)?$/.test(s.ownedBy)) {
      findings.push({ id: s.id, problem: `ownedBy "${s.ownedBy}" is not a repo-relative path` })
    }
  }
  return findings
}

/**
 * Does the `ownedBy` path exist, and does the thing it names appear in it?
 *
 * Resolvable only when the sibling repository is on disk, which it is in a working tree and is not
 * in CI, where only this repository and micro-ui are checked out. The check therefore reports
 * which mode it ran in rather than passing silently either way — a check whose result does not
 * depend on anything is the defect this whole suite was written to stop producing.
 */
export function resolveOwnedBy(ownedBy: string): 'resolved' | 'missing' | 'unavailable' {
  const [path, anchor] = ownedBy.split('#')
  const full = join(ESTATE, path ?? '')
  const repoDir = (path ?? '').split('/')[0] ?? ''
  if (!existsSync(join(ESTATE, repoDir))) return 'unavailable'
  if (!existsSync(full)) return 'missing'
  if (anchor && !readFileSync(full, 'utf8').includes(anchor)) return 'missing'
  return 'resolved'
}

/** Turn a catalogue into a suite. Blocked scenarios are recorded as data, never as skips. */
export function runCatalogue(name: string, scenarios: readonly Scenario[]): void {
  describe(`${name} — the catalogue holds together`, () => {
    it('every scenario declares what it is allowed to assert, and who owns any server rule', () => {
      const findings = checkCatalogue(scenarios)
      assert.deepEqual(
        findings,
        [],
        `the catalogue refuses to run:\n${findings.map((f) => `  ${f.id}: ${f.problem}`).join('\n')}`,
      )
    })

    it('every ownedBy that can be resolved, resolves', () => {
      const results = scenarios
        .filter((s): s is Scenario & { ownedBy: string } => Boolean(s.ownedBy))
        .map((s) => ({ id: s.id, ownedBy: s.ownedBy, state: resolveOwnedBy(s.ownedBy) }))
      const missing = results.filter((r) => r.state === 'missing')
      const unavailable = results.filter((r) => r.state === 'unavailable')
      console.log(
        `  ownedBy: ${results.length - missing.length - unavailable.length} resolved, ` +
          `${unavailable.length} not checked out, ${missing.length} missing`,
      )
      assert.deepEqual(
        missing.map((m) => `${m.id} → ${m.ownedBy}`),
        [],
        'an ownedBy names a test that is not there',
      )
    })

    it('every blocker that can be checked is still true', () => {
      /*
       * THE ASSERTION THAT STOPS A GAP FROM CLOSING UNNOTICED.
       *
       * `BJ-ACC-01` was blocked on "nothing in the estate serves a sign-in page". It was true when
       * it was written; `micro-hub-web` served `/account/login` days later and nothing went red.
       * A blocker is a claim about the estate, and a claim nothing checks is a claim that rots —
       * which is precisely what this suite exists to stop the estate producing.
       *
       * Checked wherever the sibling is on disk, and REPORTED rather than skipped when it is not:
       * in CI only this repository and micro-ui are checked out, so a silent pass either way would
       * be a check whose result does not depend on anything.
       */
      const claims = scenarios.filter(
        (s): s is Scenario & { blockedWhile: NonNullable<Scenario['blockedWhile']> } =>
          Boolean(s.blocked && s.blockedWhile),
      )
      const stale: string[] = []
      let checked = 0
      let unavailable = 0
      for (const s of claims) {
        for (const [kind, anchor] of [
          ['absent', s.blockedWhile.absent],
          ['present', s.blockedWhile.present],
        ] as const) {
          if (!anchor) continue
          const state = resolveOwnedBy(anchor)
          if (state === 'unavailable') {
            unavailable += 1
            continue
          }
          checked += 1
          const found = state === 'resolved'
          if (kind === 'absent' && found) {
            stale.push(`${s.id}: blocked because ${anchor} is missing — it is there now, so write it`)
          }
          if (kind === 'present' && !found) {
            stale.push(`${s.id}: blocked because ${anchor} is still there — it is gone now, so write it`)
          }
        }
      }
      console.log(`  blockers: ${checked} checked, ${unavailable} sibling(s) not checked out`)
      assert.deepEqual(stale, [], `a blocker has gone stale:\n  ${stale.join('\n  ')}`)
    })

    it('records the scenarios that cannot be written, with the reason', () => {
      const blocked = scenarios.filter((s) => s.blocked)
      for (const s of blocked) console.log(`  ⛔ ${s.id} — ${s.title}\n     blocked: ${s.blocked}`)
      console.log(
        `  ${scenarios.length - blocked.length} implemented, ${blocked.length} blocked, ` +
          `${scenarios.filter((s) => s.gate).length} release-gate`,
      )
      // The assertion is that each one still SAYS why. A blocked scenario whose reason was deleted
      // is a gap that has stopped being visible.
      for (const s of blocked) assert.ok((s.blocked ?? '').length > 20, `${s.id} has no blocker`)
    })
  })

  describe(name, () => {
    for (const scenario of scenarios) {
      if (!scenario.run) continue
      const star = scenario.gate ? '★ ' : ''
      const run = scenario.run
      it(`${star}${scenario.id} [T${scenario.tier}/${scenario.asserts}] ${scenario.title}`, async () => {
        await run(await startSurface(REPO))
      })
    }

    after(async () => {
      await closeBrowser()
      await stopSurface()
    })
  })
}
