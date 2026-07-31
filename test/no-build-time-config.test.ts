/**
 * The rule this template exists to keep: NOTHING IN THE BUNDLE KNOWS WHICH ENVIRONMENT IT IS IN.
 *
 * A `VITE_` variable is read at build time and frozen into the artefact. An artefact with an
 * environment frozen into it has to be rebuilt to be promoted, which means the thing that reaches
 * production is not the thing that passed CI — and the estate has already lost an afternoon to a
 * staging bundle serving production traffic against a staging API.
 *
 * Every host is resolved at runtime from `window.location.hostname` instead. This test is a grep,
 * because the failure mode is somebody adding one line in a hurry, and a grep is the only check
 * that catches that on the pull request rather than in an incident.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * TWO CHANGES FROM THE TEMPLATE'S COPY, both for the same reason.
 *
 * COMMENTS ARE STRIPPED FIRST. The template's version greps raw text, and this repository's
 * settings page explains — in prose, to a reader — that there is no build-time constant here. That
 * sentence names the thing it is denying, and the template's test therefore fails on the file that
 * documents the rule. It is the same shape as nginx.conf quoting the directive it forbids, and the
 * estate has now hit it five times. A guard that fails on its own rationale gets deleted, and then
 * the rule is gone. The rule is about CODE.
 *
 * The per-file cases are collapsed into one. Thirty-five near-identical `it`s inflate a suite's
 * count without checking thirty-five independent things; the aggregate NAMES every offender, which
 * is the only part a failure needs.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Assembled rather than written out, so this file does not match its own search. */
const ENV_PREFIX = `VITE${'_'}`
const ENV_OBJECT = `import.meta${'.'}env`

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html'])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

describe('no build-time configuration', () => {
  const files = [...sourceFiles(join(root, 'src')), join(root, 'index.html')]

  it('finds source files to check', () => {
    // A grep over an empty list passes for the wrong reason, which is the one way this test could
    // silently stop protecting anything.
    assert.ok(files.length >= 10, `expected the source tree, found ${files.length} files`)
  })

  /** Source with its comments removed — line, block and HTML. See the header. */
  const code = (file: string): string =>
    readFileSync(file, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it('no file references a build-time environment variable', () => {
    const offenders = files.filter((f) => code(f).includes(ENV_PREFIX)).map((f) => relative(root, f))
    assert.deepEqual(offenders, [], `these reference a ${ENV_PREFIX} variable: ${offenders.join(', ')}`)
  })

  it('no file reads the build-time env object', () => {
    const offenders = files.filter((f) => code(f).includes(ENV_OBJECT)).map((f) => relative(root, f))
    assert.deepEqual(offenders, [], `these read ${ENV_OBJECT}: ${offenders.join(', ')}`)
  })

  it('is stripping comments, not stripping everything', () => {
    // Without this, a `code()` that returned '' would make both assertions above pass for the
    // worst possible reason.
    const settings = code(join(root, 'src/pages/settings.tsx'))
    assert.ok(settings.includes('SettingsPage'), 'comment stripping ate the code')
    assert.ok(!settings.includes('There is deliberately'), 'comment stripping left prose behind')
  })

  it('the Vite config defines no constants and reads no env prefix', () => {
    // The other half of the same hole: `define` and `envPrefix` bake values into the bundle
    // without any source file mentioning an environment variable at all.
    const config = readFileSync(join(root, 'vite.config.ts'), 'utf8')
    assert.equal(/^\s*define\s*:/m.test(config), false, 'vite.config.ts declares define')
    assert.equal(/^\s*envPrefix\s*:/m.test(config), false, 'vite.config.ts declares envPrefix')
  })

  it('there is no .env file to read one from', () => {
    const entries = readdirSync(root)
    const envFiles = entries.filter((e) => e === '.env' || e.startsWith('.env.'))
    assert.deepEqual(envFiles, [], `unexpected env files: ${envFiles.join(', ')}`)
  })
})
