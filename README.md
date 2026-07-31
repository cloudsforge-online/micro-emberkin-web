# micro-emberkin-web

**Emberkin: Resonance** — the game client for the second Forge Worlds title.

A Warden does not command a Kin; they bond with one. What that bond becomes — **Resonance**, its
lean towards **Harmony or Ferocity**, the **Sync** built inside a fight — decides what a Kin can do
and what it grows into. That system is the product, and this client's job is to make it legible.

---

## What it is

A React single-page application with a Three.js battle view, built to this estate's frontend
conventions: hosts resolved at runtime, the SSO hand-off redeemed before the app renders, browser
telemetry to Lantern, and an honest 404 on any address it does not own.

It talks to two services:

| Service | For | How |
| --- | --- | --- |
| `micro-emberkin` | Saves, battles, cosmetics, achievements, the dex | Every call is a named function in `src/lib/emberkin.ts`, each citing the line of `emberkin/src/server.ts` it was verified against |
| `micro-billing` | What the account owns, for the wardrobe | `GET /entitlements` — see [the gaps](#what-micro-emberkin-does-not-offer) |

**Saves are server-authoritative.** Nothing in this browser decides what happened.

---

## What it restructures from `kindred-resonance`

`web/` in the upstream repository is a buildless Three.js client that ran the whole game locally.
Three things happened to it.

### Carried forward, near-untouched

`src/game/render/` is 2,100 lines of working Three.js — the over-the-shoulder stage, the six
biomes, the creature rigs, the elemental VFX — moved across as JavaScript and left as JavaScript.
It is `allowJs` without `checkJs`: type-checking somebody else's untyped render code produces a
thousand errors and finds zero bugs. Its edge is typed once, in `src/game/stage.ts`, which is the
only surface the rest of the app touches.

Two edits, total: the two hard-coded asset paths now read through `src/game/assetbase.js`. That
file is [the import seam](#the-3d-scope-stated-honestly).

### Restructured

| Upstream | Here |
| --- | --- |
| `web/game/main.js` — the game loop | `src/pages/play.tsx` — a React page that submits intent and animates a log |
| `web/game/ui/ui.js` — 1,072 lines of imperative DOM | `src/components/` and `src/pages/`, on the estate's design system |
| `web/app.js`, `web/index.html` | `src/main.tsx`, `src/app.tsx`, `index.html` |
| `web/tools/bake-ui.mjs` output | The generated art from `micro-emberkin-assets` |

### Deleted

`web/game/engine/` — the battle engine, the RNG, the damage calculator, the party model — and
`web/game/engine/save.js`, which wrote the whole game to `localStorage` and read it back as fact.

Battles resolve on the server from a seed (`emberkin/src/battles.ts:124-147`). The engine is
deterministic and reproduces the original C# bit-for-bit, so a battle log replays exactly; what
this client plays back is a recording, not a simulation. A client that *can* resolve a battle is a
client that can lie about one, so it cannot: `test/bundle.test.ts` fails if an RNG, a damage
calculation or `src/game/engine/` reappears, and so does a CI step, so deleting the test does not
delete the rule.

One consequence, stated plainly rather than hidden: the whole battle is submitted at once, because
the route resolves a whole battle. The player composes their turns and then watches. The screen
says so.

---

## The 3D scope, stated honestly

**The image generator produced 2D.** The 134 generated images cover 50 species portraits (at two
sizes), 9 type icons, 6 region keyarts, the title lockup and 12 pieces of interface chrome — which
is most of what a player actually reads.

**The creature models are not generated.** `public/game/models/creatures/*.glb` are the *procedural
glTF bakes* carried forward from `kindred-resonance`, built from code by its `tools/bake-*.mjs`
pipeline and placeholders by its own art bible's admission. Nothing in this repository implies
otherwise, and `/credits` says it to the player in as many words.

The art bible specifies an import pipeline so real models can replace them later without touching
gameplay code. That promise is only worth something if the renderer reaches its assets through one
indirection, so `src/game/assetbase.js` is that indirection: four constants and a directory, with
no gameplay file opened. `test/bundle.test.ts` asserts that nothing under `src/game/render/` names
an asset URL of its own.

A detail that is easy to break and silent when broken: the `.glb` files reference their PBR maps by
**relative URI** — `../../textures/creatures/…` from `models/creatures/`. Renaming either directory
produces untextured black creatures rather than an error. Both the test suite and the CI image
probe check the layout holds.

---

## The routes it calls

`emberkin/src/server.ts` defines ten routes and there is no eleventh. Each is cited at its call
site in `src/lib/emberkin.ts`, and `test/emberkin-routes.test.ts` asserts the request — path,
method, body, headers — for every one this client uses.

| Call | Route | Verified at |
| --- | --- | --- |
| `startGame` | `POST /v1/saves` | `server.ts:322` |
| `fetchSave` | `GET /v1/saves/me` | `server.ts:338` |
| `submitBattle` | `POST /v1/saves/me/battles` | `server.ts:345` |
| `equipCosmetic` | `PUT /v1/saves/me/cosmetics` | `server.ts:392` |
| `fetchAchievements` | `GET /v1/saves/me/achievements` | `server.ts:409` |
| `fetchDex` | `GET /v1/content/dex` | `server.ts:431` |
| `fetchReadiness` | `GET /readyz` | `server.ts:240` |
| *(billing)* | `GET /entitlements` | `billing/src/server.ts:473` |

Not called: `GET /livez`, `GET /metrics`, and `POST /v1/events` — the last is a signature-checked
webhook and is not a browser's business.

**Why the citations.** This estate has shipped two clients written against routes that did not
exist. `micro-wallet` called `/v1/quotes` when pricing serves `/rates`. `micro-market` called
`/v1/decisions/market.listing` when `micro-policy` has no `/v1` routes at all — and because policy
reads a 404 as `peerDecided`, that returned **403 on every listing** and closed the marketplace.
Both had tests; both stubbed `fetch` and asserted only the response, which the test itself had
written. A route string here is a claim about a specific line of another repository.

### What `micro-emberkin` does not offer

Two gaps, handled rather than papered over. Reported upstream; not fixed here, because that
repository is single-owner.

**Nothing writes `currentRegion`, `storyProgress`, `playtimeSeconds`, `inventory` or `seals`.**
`POST /v1/saves` sets them once at creation; the battle route rewrites party, box and `dexSeen`;
the cosmetics route rewrites `equipped_cosmetics`. So travel and story progress cannot be
persisted, and the satchel is read-only. The party and satchel screens say why rather than growing
disabled buttons.

**Nothing lists the account's cosmetic entitlements.** `micro-emberkin` reaches billing at
`/internal/entitlements/:userId`, which refuses a user token by design
(`billing/src/server.ts:505-508`). The wardrobe therefore reads billing's own `GET /entitlements`
directly, and `src/lib/billing.ts` reproduces `emberkin/src/billingclient.ts:80-93`'s ownership
rule byte for byte so the two sides cannot disagree about what "owns" means. A client that must
reach a second service to render one screen degrades twice; that degradation is handled, but the
route would be better.

---

## The registry does not know this surface exists

`@cloudsforge/ui`'s surface registry has no `emberkin` key — Emberkin joined the programme after
the registry was written. `micro-ui` is single-owner, so `src/lib/hosts.ts` works around it, in two
places, both of which delete themselves the day an entry lands.

1. **Its own host is derived.** `deriveSurfaceUrl` takes a registry surface that does exist
   (`worlds-api`) and swaps the subdomain, or the dev port on localhost. It adds only the two facts
   the registry lacks: the subdomain `emberkin` and port `4100` (`emberkin/src/env.ts:121`).

2. **The registry's other answers are corrected**, and this one is a real defect rather than an
   inconvenience. `cloudsforgeHosts()` derives the apex by stripping a *known* subdomain, and
   `KNOWN_SUBS` is built from the registry's own list (`ui/packages/ui/src/surfaces.ts:521-525`).
   Served from `https://emberkin.<apex>`, it resolved `nimbus` → `https://nimbus.emberkin.<apex>`,
   and likewise `pay` and `lantern` — sign-in, billing and telemetry each addressing a hostname
   that does not exist. `hosts()` removes the stray label. `test/hosts.test.ts` pins the *wrong*
   answer on purpose, so when `micro-ui` gains an entry those assertions fail and take the
   workaround with them.

The switcher marks **Worlds** current, which is true rather than merely convenient: Emberkin is a
Forge Worlds title.

---

## Accessibility

Against the brand ground `#12100f`, on the design system's warm substrate.

**Colour is never the only channel, and here that is load-bearing.** The brief said `micro-ui`
carries a CVD-corrected type palette; it does not. `micro-ui` has the five product accents and an
eight-slot categorical viz palette, both validated, and neither is an element palette. The nine
element hues are art-direction values recorded per icon in the asset manifest, and as a *set* they
are not separable: measured against the validated palette's own adjacency guarantee, five pairs
fall below it and frost/gale falls to about a quarter of it. As art they are two different
creatures; as a label they are one colour.

So a type is **always** its generated icon plus its written name, the tint reaches only a border
and a glow, and `typeChip()` cannot produce a chip without a label. `test/types.test.ts` measures
the palette and fails if somebody later simplifies a chip to a dot.

The rest: every meter carries `aria-valuetext` naming the *band* rather than only the number; every
state differs in shape and words as well as colour; type effectiveness is a phrase, never a hue;
"met", "worn", "fainted" and the current page are each stated in text. Reduced motion follows the
operating system with no interaction, and an in-app "I did not ask for reduced motion" deliberately
does **not** overrule an OS that did.

## Never invent a number

**Sync is not in a save.** It resets each battle and `kinToSave` does not persist it, so this client
has no way to know it outside a battle — and there is no route that returns a live one. The HUD
renders a sentence in the Sync slot rather than a bar at zero, because a bar at zero is a claim and
it is false for any Kin that has ever spent Sync on an Art.

Max HP, by contrast, *is* derivable exactly — `attunement`, `level` and `resonance` come from the
save and the base stat from the local content — so it is computed, with the engine's truncation
order reproduced to the point (`emberkin/src/engine/kin.ts:148-153`) and pinned by test. Where the
local content copy lacks a species, the raw number is shown alone rather than a bar with no scale.

---

## Performance

It is a game client, so the numbers are in the build log and CI prints them on every run.

| Chunk | Size | Gzip | When |
| --- | --- | --- | --- |
| entry (`index`) | 321 kB | 97 kB | always |
| `three` | 731 kB | 190 kB | **only on the battle view** |
| render layer (5 chunks) | 35 kB | 13 kB | with it |
| `play` | 14 kB | 5 kB | on that route |
| CSS | 32 kB | 7 kB | always |

`three` is behind a dynamic import inside a `lazy()` route, so the dex, the party screen, the
wardrobe and settings download none of it. The WebGL probe lives in its own module for the same
reason — Vite warns that a module both statically and dynamically imported "will not move into
another chunk", which would have undone the boundary in one convenient import.

The dex asks for the 256 px species thumbnails (41 kB each), not the 1024 px portraits (584 kB): a
grid of fifty portraits would be 29 MB of images to draw a page of thumbnails.

A browser without WebGL is not a broken game. The probe answers first, the renderer is never
downloaded, and the battle plays as its log — which is complete, because the fight was resolved on
the server either way.

---

## Running it

```sh
pnpm --dir ../ui install            # @cloudsforge/ui is a link: sibling until it is published
pnpm install
pnpm dev                            # http://localhost:5195
```

`micro-emberkin` on `4100` and `micro-billing` on `4003`. There is **no `.env`** and there must
never be one: every host is resolved from `window.location.hostname` at request time, so one image
serves localhost, a preview deployment and production. `test/no-build-time-config.test.ts` and a CI
step both fail if `import.meta.env` or a `VITE_` variable appears.

```sh
pnpm typecheck
pnpm test                           # 429 tests, node:test only
pnpm build
pnpm sync-art                       # regenerate src/art/catalogue.ts from the asset manifest
```

### The image

```sh
docker build -t emberkin-web --build-context uipkg=../ui .
docker run --rm -p 8080:8080 emberkin-web
```

Two stages; the final image is nginx-unprivileged serving static files, with no Node, no toolchain,
no source and no secret in it. 198 MB, of which 65 MB is the art and the models.

`nginx.conf` **enumerates** the real routes and answers 404 for everything else, serving the app
shell through `error_page 404 /index.html` so the page is real and the status line is true.
`test/routes.test.ts` checks that `src/lib/routes.ts`, `src/app.tsx` and `nginx.conf` all agree — a
route added to the router and not to nginx works perfectly under `pnpm dev` and 404s on the first
hard refresh.

Two things in it differ from the web template, and both were found by probing a running image
rather than by reading the config:

- **`Cache-Control: no-store` is repeated on every location that serves `index.html`.**
  `location = /index.html` matches only that literal path; `location = /` and the route block serve
  the same file through `try_files` without re-entering it. Under the template's config the
  most-requested address in the application — `/` — is served with no cache directive at all.

- **The three security headers are repeated in every location that sets a header of its own.**
  nginx's `add_header` inheritance is all-or-nothing per level: a location containing even one
  `add_header` discards every one from the enclosing block. The template sets `Cache-Control`
  inside `location /assets/`, and therefore serves every hashed asset in every application cut from
  it with no `X-Content-Type-Options`. The directive that was added is visible in a diff; the three
  that were removed are not. Both are asserted by `test/routes.test.ts` now.

---

## Tests

`node:test` only. 429 of them, no DOM, and every one able to fail — ten deliberate mutations were
run against the suite (a wrong route path, a dropped `Idempotency-Key`, an omitted `null itemUrn`,
a cosmetic that changes a stat, Sync drawn as zero, the max-HP truncation collapsed, a route missing
from nginx, a failed billing read rendered as empty, a suppressed type label, an in-app toggle
overruling the OS) and all ten were caught.

What they cover, and why each one exists:

- **`emberkin-routes`** — the request for every call, plus a negative test that collects every path
  sent and checks it against the ten routes the service compiles.
- **`hosts`** — all sixteen environment cases, and the registry defect above.
- **`resonance`** — every threshold from both sides, against the service's own constants.
- **`battle`** — every intent key by key against `parseScript`, and every log cue quoted from the
  engine. Its first draft matched two phrases the engine never writes.
- **`cosmetics`** — a cosmetic leaves a Kin byte-identical at every bond band. It compares the Kin,
  not the copy, which is what would catch the "harmless" +1 that starts the slide.
- **`save`** — `absent` is not `failed`; a catch is the tail of an append-only box.
- **`art`** — every species has art at both sizes, every file exists, the catalogue matches the
  manifest.
- **`degradation`** — all sixteen source-failure combinations, and `resourceState`'s rule that
  failure outranks emptiness in both directions.
- **`content`, `types`, `kin`, `items`, `prefs`, `routes`, `bundle`, `no-build-time-config`, `obs`.**

Looped cases that were padding have been collapsed: 134 file-existence checks are one test that
names every missing file. What is left is 429 independent assertions, which is more than the
174–185 the sibling frontends run; cutting real ones to hit a number seemed the wrong trade.

---

## Provenance

Every image is AI-generated. `public/art/MANIFEST.json` carries per-asset provenance — prompt,
model, dimensions, post-processing, C2PA state, licence — and is served whole at
`/art/MANIFEST.json`, where the `/credits` page renders the manifest's own disclosure rather than
paraphrasing it. The bundle reads a 24 kB derivative with the prompts stripped out; 776 kB of prose
does not belong in a game client's entry chunk.

The game itself descends from KINDRED: Resonance. The battle engine, the 50 species, the 47 moves,
the 9 elements and the Resonance / Temperament / Sync system are its design, ported and kept.
`kindred-resonance` is read-only reference and is not modified.
