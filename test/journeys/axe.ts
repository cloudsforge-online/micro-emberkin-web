/**
 * axe-core, run inside the page.
 *
 * doc 22 group T asks for axe on every route of every surface and on every modal, failing on any
 * serious or critical violation. `axe-core` is a single self-contained script with no browser of
 * its own, so it is injected into the page the suite already has rather than pulling in
 * `@axe-core/playwright` — which would be a second dependency wrapping the same file.
 *
 * ── Serious and critical only, and why the line is drawn there ────────────────────────────────
 *
 * axe's `minor` and `moderate` findings include things that are matters of taste in a design
 * system (region landmarks on a fragment, colour contrast at 4.4:1). Failing on them would produce
 * a suite people switch off. `serious` and `critical` are the ones a screen-reader user cannot
 * work around, and 14 §11 names exactly that threshold.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { Page } from 'playwright-core'

const require = createRequire(import.meta.url)

let source: string | null = null
function axeSource(): string {
  if (source === null) source = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
  return source
}

export interface Violation {
  readonly id: string
  readonly impact: string
  readonly help: string
  readonly nodes: string[]
}

export interface AxeOptions {
  /** Restrict the sweep to one subtree — the open dialog, for a modal scenario. */
  readonly within?: string
  /**
   * Rules to switch off, each with the reason. Empty by default and expected to stay that way:
   * an exclusion here is a defect somebody decided not to fix, so it has to be written down.
   */
  readonly disable?: ReadonlyArray<readonly [rule: string, why: string]>
}

/** Every serious or critical violation on the page as it currently stands. */
export async function axeViolations(page: Page, options: AxeOptions = {}): Promise<Violation[]> {
  await page.evaluate(axeSource())
  const disabled = (options.disable ?? []).map(([rule]) => rule)
  const raw = await page.evaluate(
    async ({ within, disabled: off }: { within: string | null; disabled: string[] }) => {
      const axe = (globalThis as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<unknown> } }).axe
      const context = within ?? document
      const rules = Object.fromEntries(off.map((r) => [r, { enabled: false }]))
      const result = (await axe.run(context, { resultTypes: ['violations'], rules })) as {
        violations: Array<{ id: string; impact: string; help: string; nodes: Array<{ html: string }> }>
      }
      return result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 160)),
      }))
    },
    { within: options.within ?? null, disabled },
  )
  return raw.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

export function describeViolations(violations: readonly Violation[]): string {
  return violations
    .map((v) => `  [${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.join('\n    ')}`)
    .join('\n')
}

/**
 * A violation this surface cannot fix, with who can.
 *
 * ── Why an exclusion list is safe here and is not a way of switching the check off ─────────────
 *
 * `assertAxeClean` asserts BOTH directions: nothing outside the list, and every entry in the list
 * still failing. So an exclusion cannot outlive the defect — the day the owner fixes it, this
 * suite goes red and the entry has to be deleted. An exclusion that could quietly stay for ever
 * would be the same defect as a test that can only pass, which is the class this whole suite was
 * written to stop the estate producing.
 */
export interface KnownViolation {
  readonly rule: string
  /** The repository that owns the fix, and what is actually wrong. */
  readonly owner: string
}

/**
 * Assert `page` is clean apart from `known`, and report which of `known` it actually hit.
 *
 * The second return value is what makes the exclusion honest, and it is accumulated ACROSS a
 * sweep rather than checked per page: a route with no muted caption on it does not exercise the
 * contrast defect, and demanding that every page fail every known rule would be demanding a page
 * be broken. `assertKnownStillBroken` closes the loop at the end of the sweep.
 */
export async function assertAxeClean(
  page: Page,
  where: string,
  known: readonly KnownViolation[] = [],
  options: AxeOptions = {},
): Promise<Set<string>> {
  const violations = await axeViolations(page, options)
  const allowed = new Set(known.map((k) => k.rule))

  const unexpected = violations.filter((v) => !allowed.has(v.id))
  if (unexpected.length > 0) {
    throw new Error(`${where}: axe found serious or critical violations\n${describeViolations(unexpected)}`)
  }
  return new Set(violations.map((v) => v.id))
}

/**
 * Every known violation was still seen somewhere in the sweep.
 *
 * Without this the exclusion list is a permanent excuse: it would silently outlive the defect and
 * quietly suppress the same rule when it came back somewhere else. With it, the day micro-ui
 * raises the token the suite goes red and says which entry to delete — a check that fails in both
 * directions, which is what this estate keeps not building.
 */
export function assertKnownStillBroken(seen: ReadonlySet<string>, known: readonly KnownViolation[]): void {
  const fixed = known.filter((k) => !seen.has(k.rule))
  if (fixed.length > 0) {
    throw new Error(
      `${fixed.map((f) => f.rule).join(', ')} no longer fails anywhere on this surface.\n` +
        `That is good news, and the exclusion must now be deleted from this scenario:\n` +
        fixed.map((f) => `  ${f.rule} — was owned by ${f.owner}`).join('\n'),
    )
  }
}

/**
 * The DOM order of two pieces of text.
 *
 * Several scenarios in doc 22 are about ORDER — "the disclosure is above the stake form", "the
 * caveats come before the instructions", "the sources precede the approve control". Order in the
 * accessibility tree is what a screen-reader user and a keyboard user actually get, so it is read
 * from the rendered text rather than from the source file.
 */
export async function textOrder(page: Page, first: string, second: string): Promise<'before' | 'after' | 'missing'> {
  return page.evaluate(
    ([a, b]: [string, string]) => {
      const text = document.body?.innerText ?? ''
      const i = text.indexOf(a)
      const j = text.indexOf(b)
      if (i === -1 || j === -1) return 'missing' as const
      return i < j ? ('before' as const) : ('after' as const)
    },
    [first, second] as [string, string],
  )
}

/**
 * The skip link, asserted the way a keyboard reader meets it.
 *
 * Three things, and only the third can go wrong invisibly:
 *
 *   1. Pressing `Tab` once from the top of the document focuses it. Reading `querySelector('a')`
 *      would prove DOCUMENT order, which is a different thing — a `tabindex`, an `inert` ancestor
 *      or a focus trap changes one without changing the other.
 *   2. It points at a landmark that is actually on the page.
 *   3. It is off-screen until focused and **inside the viewport** once it is. A skip link that
 *      stays hidden when focused is worse than none: the reader activates it and cannot tell
 *      whether anything happened.
 *
 * The third is checked as "is the box inside the viewport", not as "did `top` increase", because
 * surfaces move it on different axes — `site` slides it down, `network-site` slides it in from
 * the left. Asserting an axis would assert one implementation and fail a correct alternative,
 * which is how a guard ends up being deleted rather than satisfied.
 */
export async function assertSkipLink(page: Page, where: string, target = '#main'): Promise<void> {
  const inViewport = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const box = el.getBoundingClientRect()
      return {
        href: el.getAttribute('href'),
        onScreen:
          box.width > 0 &&
          box.height > 0 &&
          box.right > 0 &&
          box.bottom > 0 &&
          box.left < window.innerWidth &&
          box.top < window.innerHeight,
      }
    })

  const hidden = await page.evaluate(() => {
    const first = document.body.querySelector('a[href]')
    if (!first) return null
    const box = first.getBoundingClientRect()
    return box.right > 0 && box.bottom > 0 && box.left < window.innerWidth && box.top < window.innerHeight
  })
  if (hidden === null) throw new Error(`${where}: the page has no links at all`)

  await page.keyboard.press('Tab')
  const focused = await inViewport()
  if (!focused) throw new Error(`${where}: pressing Tab from the top of the document focused nothing`)
  if (focused.href !== target) {
    throw new Error(`${where}: the first thing Tab reaches is ${focused.href}, not the skip link ${target}`)
  }

  const exists = await page.evaluate((sel: string) => Boolean(document.querySelector(sel)), target)
  if (!exists) throw new Error(`${where}: the skip link points at ${target}, which is not on the page`)

  // The move may be a CSS transition, so it is waited for rather than read once.
  const arrived = await page
    .waitForFunction(
      () => {
        const el = document.activeElement as HTMLElement | null
        if (!el) return false
        const box = el.getBoundingClientRect()
        return (
          box.width > 0 &&
          box.height > 0 &&
          box.right > 0 &&
          box.bottom > 0 &&
          box.left < window.innerWidth &&
          box.top < window.innerHeight
        )
      },
      undefined,
      { timeout: 3_000 },
    )
    .then(() => true)
    .catch(() => false)
  if (!arrived) throw new Error(`${where}: the skip link never came into view while focused`)
  if (hidden) throw new Error(`${where}: the skip link is on screen before it is focused`)
}

/**
 * One `main` landmark, and a heading order with no level skipped.
 *
 * A skipped level is not a style question: a screen-reader user navigating by heading is told the
 * document has a structure it does not have, and an h1 that is not first means the page never
 * announces what it is.
 */
export async function assertLandmarks(page: Page, where: string): Promise<void> {
  // Wait for the first heading before measuring. These pages fetch before they render their own
  // head, so a check taken at mount time reads the shell alone and reports "no headings at all" on
  // a page that has one. If none ever arrives the wait expires and the assertion below fires with
  // the same message — the wait changes when the answer is read, never what counts as an answer.
  await page.waitForSelector('h1', { timeout: 10_000 }).catch(() => undefined)
  const structure = await page.evaluate(() => ({
    mains: document.querySelectorAll('main').length,
    levels: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName.slice(1))),
  }))
  if (structure.mains !== 1) throw new Error(`${where}: ${structure.mains} main landmarks`)
  if (structure.levels.length === 0) throw new Error(`${where}: no headings at all`)
  if (structure.levels[0] !== 1) throw new Error(`${where}: opens with h${structure.levels[0]}, not h1`)
  let previous = 0
  for (const level of structure.levels) {
    if (level > previous + 1) throw new Error(`${where}: jumps from h${previous} to h${level}`)
    previous = level
  }
}

/**
 * The tab order, as a list of accessible names.
 *
 * Used by the keyboard-only scenarios. Reads `document.activeElement` after each `Tab`, which is
 * the same thing a keyboard user experiences and is not derivable from the markup: a `tabindex`,
 * a focus trap or an `inert` ancestor all change it without changing document order.
 */
export async function tabOrder(page: Page, steps: number): Promise<string[]> {
  const order: string[] = []
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab')
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return '(body)'
        const label =
          el.getAttribute('aria-label') ??
          el.getAttribute('placeholder') ??
          (el.innerText || el.getAttribute('title') || el.getAttribute('name') || '')
        return `${el.tagName.toLowerCase()}:${label.trim().slice(0, 40)}`
      }),
    )
  }
  return order
}
