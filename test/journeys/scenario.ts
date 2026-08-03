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
