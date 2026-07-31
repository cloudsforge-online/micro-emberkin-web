/**
 * Where the 3D assets live. THE IMPORT SEAM.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE 3D IS NOT GENERATED, AND THIS FILE IS WHY THAT IS A SCOPE NOTE RATHER THAN A REWRITE.
 *
 * FLUX produced 2D. The 50 creature models and 12 biome props under `public/game/models/` are the
 * PROCEDURAL glTF bakes carried forward from `kindred-resonance` `web/tools/bake-*.mjs` — built
 * from code, and placeholders by their own art bible's admission (19 §1.4).
 *
 * The art bible specifies an import pipeline so that real, modelled assets can replace them later
 * without touching gameplay code. That promise is only worth anything if the renderer reaches its
 * assets through ONE indirection, so here it is. Nothing in `render/` names a URL; everything
 * loads from a base declared here, and a real model set becomes a change to four constants and a
 * directory, with no gameplay file opened.
 *
 * The upstream values were `"../assets/models/biomes/"` — relative to `web/game/`, the directory
 * the buildless client was served from. Under Vite the assets are served from `public/`, so they
 * are absolute now. That is the only edit made to the carried-forward render layer's addressing.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * A NOTE ON THE TEXTURE PATH, which is load-bearing and easy to break: the `.glb` files reference
 * their PBR maps by RELATIVE URI — `../../textures/creatures/fur_albedo.png` from
 * `models/creatures/`. So `public/game/textures/` must sit exactly two levels up from the models,
 * and renaming either directory silently produces untextured black creatures rather than an error.
 * `test/game-assets.test.ts` asserts the relationship holds on disk.
 */

/** Baked creature models, one `.glb` per species. */
export const CREATURE_BASE = '/game/models/creatures/'

/** Baked biome props — rocks, arches, canopies. */
export const PROP_BASE = '/game/models/biomes/'

/** Shared environment PBR maps, referenced by `environments.js` directly. */
export const ENV_TEX_BASE = '/game/textures/env/'

/** Shared creature PBR maps. Referenced by the `.glb` files themselves, by relative URI. */
export const CREATURE_TEX_BASE = '/game/textures/creatures/'
