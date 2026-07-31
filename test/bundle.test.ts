/**
 * The lazy boundary, and the things that must not come back.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * IT IS A GAME CLIENT — PERFORMANCE IS A FEATURE.
 *
 * `three` is 731 kB, and exactly one page needs it. If it ever leaks into the entry chunk, every
 * menu pays for a renderer it never uses, and the symptom is a page that feels slow rather than a
 * test that fails. So the boundary is asserted on the SOURCE here, and on the BUILD OUTPUT in
 * `.github/workflows/ci.yml` — both, because they can fail independently: an import can be correct
 * while the bundler's chunking is not.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The second half of this file guards the product decision underneath the whole repository:
 * battles resolve on the server. The upstream client ran the engine in the browser and wrote the
 * result to localStorage. Those files are deleted; a reappearance would be a product regression
 * dressed as a refactor.
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = new URL('../', import.meta.url)
const abs = (path: string): string => fileURLToPath(new URL(path, root))

/** Every source file under a directory, recursively. */
function walk(dir: string, exts: readonly string[]): string[] {
  const out: string[] = []
  const base = abs(dir)
  if (!existsSync(base)) return out
  const visit = (relative: string): void => {
    for (const entry of readdirSync(abs(relative))) {
      const next = `${relative}/${entry}`
      if (statSync(abs(next)).isDirectory()) visit(next)
      else if (exts.some((e) => entry.endsWith(e))) out.push(next)
    }
  }
  visit(dir)
  return out
}

const sources = walk('src', ['.ts', '.tsx', '.js'])
const read = (path: string): string => readFileSync(abs(path), 'utf8')

/**
 * A file with its comments removed.
 *
 * THE MISTAKE THIS AVOIDS HAS NOW BEEN MADE FIVE TIMES IN THIS ESTATE: a guard greps raw source
 * for the thing it forbids, and fails on the comment that EXPLAINS why the thing is forbidden.
 * `nginx.conf`'s header quotes the directive it bans; `site/src/lib/hosts.ts` names a hostname in
 * order to say that hostnames must not be named; and this repository's `save.ts` and `battle.ts`
 * both describe, at length, the localStorage the upstream client used and this one does not.
 *
 * A guard that fails on its own rationale gets deleted, and then the rule is gone. So the prose
 * comes off first, and the rules below are about CODE.
 */
const code = (path: string): string =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('the source tree', () => {
  it('is not empty, so nothing below can pass by finding no files', () => {
    assert.ok(sources.length > 20, `only found ${sources.length} source files`)
  })
})

describe('THREE IS REACHED ONLY FROM src/game/', () => {
  const importsThree = (source: string): boolean =>
    /from\s+['"]three(\/|['"])/.test(source) || /import\(\s*['"]three['"]\s*\)/.test(source)

  it('no module outside src/game/ imports three', () => {
    const offenders = sources.filter((f) => !f.startsWith('src/game/')).filter((f) => importsThree(code(f)))
    assert.deepEqual(offenders, [], `these import three and are outside the lazy boundary: ${offenders.join(', ')}`)
  })

  it('src/game/ DOES import it, so the assertion above is not vacuous', () => {
    const inside = sources.filter((f) => f.startsWith('src/game/')).filter((f) => importsThree(code(f)))
    assert.ok(inside.length > 0, 'nothing imports three at all; the test above proves nothing')
  })

  it('stage.ts reaches three by DYNAMIC import, not a static one', () => {
    const source = read('src/game/stage.ts')
    assert.match(source, /import\(\s*'three'\s*\)/)
    assert.ok(!/^import .* from 'three'/m.test(source), 'stage.ts statically imports three')
  })

  it('the WebGL probe lives OUTSIDE stage.ts', () => {
    // Vite says it plainly: a module both dynamically and statically imported "will not move into
    // another chunk". `pages/play.tsx` must ask "can this machine render" without pulling the
    // renderer in to ask, so the probe is its own module.
    assert.ok(existsSync(abs('src/game/webgl.ts')))
    assert.ok(!read('src/game/stage.ts').includes('webglAvailable'), 'the probe is back inside stage.ts')
  })

  it('play.tsx imports the probe statically and the stage dynamically', () => {
    const source = read('src/pages/play.tsx')
    assert.match(source, /import \{ webglAvailable \} from '\.\.\/game\/webgl\.ts'/)
    assert.match(source, /import\(\s*'\.\.\/game\/stage\.ts'\s*\)/)
    // A value import of stage.ts would statically bind the renderer to this page's chunk. The type
    // import is erased at compile time and is fine.
    assert.ok(
      !/^import \{[^}]*\} from '\.\.\/game\/stage\.ts'/m.test(source),
      'play.tsx statically imports a VALUE from stage.ts',
    )
  })

  it('the play page is the only lazy() route, and it is lazy', () => {
    const app = read('src/app.tsx')
    assert.match(app, /lazy\(async \(\) => \(\{ default: \(await import\('\.\/pages\/play\.tsx'\)\)\.PlayPage \}\)\)/)
  })

  it('no page other than play reaches the game directory at all', () => {
    const pages = sources.filter((f) => f.startsWith('src/pages/') && !f.endsWith('play.tsx'))
    const offenders = pages.filter((f) => code(f).includes('/game/'))
    assert.deepEqual(offenders, [], `these pages reach into src/game/: ${offenders.join(', ')}`)
  })
})

describe('THE CLIENT CANNOT RESOLVE A BATTLE', () => {
  it('has no client-side engine directory', () => {
    assert.ok(!existsSync(abs('src/game/engine')), 'src/game/engine is back')
  })

  it('has no RNG anywhere in src', () => {
    // Nothing in a client that submits intent and renders a result needs one. Its reappearance is
    // the first symptom of the engine coming back.
    const offenders = sources.filter((f) => /\bclass Rng\b|new Rng\(/.test(code(f)))
    assert.deepEqual(offenders, [], `an RNG has appeared in: ${offenders.join(', ')}`)
  })

  it('computes no damage', () => {
    const offenders = sources.filter((f) => /computeDamage|calculateDamage/.test(code(f)))
    assert.deepEqual(offenders, [], `damage is being computed in: ${offenders.join(', ')}`)
  })

  it('writes no game state to localStorage — only device preferences', () => {
    // `src/lib/api.ts` stores the shared tokens and `src/lib/prefs.ts` stores motion and contrast.
    // Both are facts about the DEVICE. A save is not.
    const allowed = new Set(['src/lib/api.ts', 'src/lib/prefs.ts'])
    const offenders = sources.filter((f) => !allowed.has(f)).filter((f) => code(f).includes('localStorage'))
    assert.deepEqual(offenders, [], `these touch localStorage: ${offenders.join(', ')}`)
  })

  it('the save module offers no way to patch a save locally', () => {
    assert.ok(!/export function updateSave|export function patchSave/.test(code('src/lib/save.ts')))
  })
})

describe('no build-time configuration reaches the game layer either', () => {
  it('src/game/ reads no import.meta.env', () => {
    const offenders = sources
      .filter((f) => f.startsWith('src/game/'))
      .filter((f) => /import\.meta\.env|VITE_/.test(code(f)))
    assert.deepEqual(offenders, [], offenders.join(', '))
  })

  it('the render layer names no URL of its own — everything goes through assetbase.js', () => {
    // The import seam the art bible's pipeline depends on. A hard-coded '/game/models/...' inside
    // render/ would mean a real model set could not land without editing rendering code.
    const offenders = walk('src/game/render', ['.js']).filter((f) => /['"]\/(game|art)\//.test(code(f)))
    assert.deepEqual(offenders, [], `these name an asset URL directly: ${offenders.join(', ')}`)
  })
})

describe('the glTF assets and their textures keep the layout the .glb files expect', () => {
  it('has the models where assetbase.js says', () => {
    assert.ok(existsSync(abs('public/game/models/creatures/cindercub.glb')))
    assert.ok(existsSync(abs('public/game/models/biomes/island.glb')))
  })

  it('has 50 creature models — one per species', () => {
    const models = readdirSync(abs('public/game/models/creatures')).filter((f) => f.endsWith('.glb'))
    assert.ok(models.length >= 50, `only ${models.length} creature models`)
  })

  it('places the textures EXACTLY two levels above the models', () => {
    // The .glb files reference their PBR maps by relative URI — `../../textures/creatures/…` from
    // `models/creatures/`. Renaming either directory silently produces untextured black creatures
    // rather than an error.
    const glb = readFileSync(abs('public/game/models/creatures/cindercub.glb'))
    const jsonLength = glb.readUInt32LE(12)
    const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as {
      images?: { uri: string }[]
    }
    const uris = gltf.images?.map((i) => i.uri) ?? []
    assert.ok(uris.length > 0, 'the model references no textures; this test would pass vacuously')
    for (const uri of uris) {
      const resolved = new URL(uri, new URL('public/game/models/creatures/', root))
      assert.ok(existsSync(fileURLToPath(resolved)), `${uri} does not resolve from the model's directory`)
    }
  })
})
