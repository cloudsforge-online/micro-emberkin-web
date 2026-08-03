/**
 * The browser journeys, tiers 1 and 2, from docs/ecosystem/22-browser-journeys.md.
 *
 * The catalogue is data in `test/journeys/catalogue.ts` so that the declarations can be read
 * without running them — by the meta-test that enforces the layer boundary, and by anything that
 * later wants to export them. This file is the entry point `pnpm test` picks up, and nothing more.
 *
 * Tier 3 — anything needing the estate up — is not here and never will be. It lives in
 * `micro-beacon`, which already defines what a journey is and is already the release gate
 * (doc 22 §2.3).
 */
import { CATALOGUE } from './journeys/catalogue.ts'
import { runCatalogue } from './journeys/scenario.ts'

runCatalogue('browser journeys', CATALOGUE)
