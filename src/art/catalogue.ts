/**
 * Every generated image, and where it is served from. GENERATED — do not edit.
 *
 * Written by `tools/sync-art.mjs` from `public/art/MANIFEST.json`, which came from
 * `micro-emberkin-assets`. Run `pnpm sync-art` after copying a new asset set in;
 * `test/art.test.ts` fails if this file and the manifest disagree.
 *
 * The manifest's own provenance — the FLUX prompt, the model, the C2PA state, the licence and the
 * AI disclosure — is deliberately NOT copied here. It is served whole at `/art/MANIFEST.json`
 * and read by the credits page, so the disclosure travels with the images rather than being
 * summarised by the code that displays them.
 *
 * Generator: @cloudsforge/studio via emberkin-assets/generate.ts
 * Assets: 134
 * Updated: 2026-07-31T20:31:24.035Z
 */

export interface ArtEntry {
  /** `species` | `types` | `biomes` | `ui` | `title`. */
  readonly set: string
  readonly slug: string
  readonly name: string
  /** Absolute, browser-resolvable, served by nginx from `/art/`. */
  readonly path: string
  /** `<w>x<h>` as delivered. Two entries per species: a 256 thumbnail and a 1024 portrait. */
  readonly size: string
  readonly accent: string | null
  /** The evolution family this species belongs to, from `visuals.json`. */
  readonly family: string | null
  /** `base` | `mid` | `final` | `apex` — how far along the family it stands. */
  readonly stage: string | null
}

export const ART: readonly ArtEntry[] = [
  {"set":"biomes","slug":"emberfall_vale","name":"Emberfall Vale","path":"/art/biomes/emberfall_vale-1536x640.png","size":"1536x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"biomes","slug":"galecrest","name":"Galecrest","path":"/art/biomes/galecrest-1536x640.png","size":"1536x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"biomes","slug":"lumen_core","name":"The Lumen Core","path":"/art/biomes/lumen_core-1536x640.png","size":"1536x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"biomes","slug":"sunken_cathedral","name":"The Sunken Cathedral","path":"/art/biomes/sunken_cathedral-1536x640.png","size":"1536x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"biomes","slug":"tidalreach","name":"Tidalreach","path":"/art/biomes/tidalreach-1536x640.png","size":"1536x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"biomes","slug":"verdant_spire","name":"The Verdant Spire","path":"/art/biomes/verdant_spire-1536x640.png","size":"1536x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"species","slug":"aetherion","name":"Aetherion","path":"/art/species/aetherion-1024x1024.png","size":"1024x1024","accent":"#ffe59e","family":"aetherion","stage":"apex"},
  {"set":"species","slug":"aetherion","name":"Aetherion","path":"/art/species/aetherion-256x256.png","size":"256x256","accent":"#ffe59e","family":"aetherion","stage":"apex"},
  {"set":"species","slug":"arcbulb","name":"Arcbulb","path":"/art/species/arcbulb-1024x1024.png","size":"1024x1024","accent":"#ffd23f","family":"arcbulb","stage":"mid"},
  {"set":"species","slug":"arcbulb","name":"Arcbulb","path":"/art/species/arcbulb-256x256.png","size":"256x256","accent":"#ffd23f","family":"arcbulb","stage":"mid"},
  {"set":"species","slug":"bastion","name":"Bastion","path":"/art/species/bastion-1024x1024.png","size":"1024x1024","accent":"#c9a06b","family":"oreling","stage":"final"},
  {"set":"species","slug":"bastion","name":"Bastion","path":"/art/species/bastion-256x256.png","size":"256x256","accent":"#c9a06b","family":"oreling","stage":"final"},
  {"set":"species","slug":"beetlord","name":"Beetlord","path":"/art/species/beetlord-1024x1024.png","size":"1024x1024","accent":"#5fce7a","family":"mossbug","stage":"final"},
  {"set":"species","slug":"beetlord","name":"Beetlord","path":"/art/species/beetlord-256x256.png","size":"256x256","accent":"#5fce7a","family":"mossbug","stage":"final"},
  {"set":"species","slug":"bloomward","name":"Bloomward","path":"/art/species/bloomward-1024x1024.png","size":"1024x1024","accent":"#5fce7a","family":"seedling","stage":"final"},
  {"set":"species","slug":"bloomward","name":"Bloomward","path":"/art/species/bloomward-256x256.png","size":"256x256","accent":"#5fce7a","family":"seedling","stage":"final"},
  {"set":"species","slug":"borealynx","name":"Borealynx","path":"/art/species/borealynx-1024x1024.png","size":"1024x1024","accent":"#8ee7ff","family":"frostkit","stage":"final"},
  {"set":"species","slug":"borealynx","name":"Borealynx","path":"/art/species/borealynx-256x256.png","size":"256x256","accent":"#8ee7ff","family":"frostkit","stage":"final"},
  {"set":"species","slug":"boulderling","name":"Boulderling","path":"/art/species/boulderling-1024x1024.png","size":"1024x1024","accent":"#c9a06b","family":"pebblit","stage":"mid"},
  {"set":"species","slug":"boulderling","name":"Boulderling","path":"/art/species/boulderling-256x256.png","size":"256x256","accent":"#c9a06b","family":"pebblit","stage":"mid"},
  {"set":"species","slug":"bramblejaw","name":"Bramblejaw","path":"/art/species/bramblejaw-1024x1024.png","size":"1024x1024","accent":"#5fce7a","family":"seedling","stage":"final"},
  {"set":"species","slug":"bramblejaw","name":"Bramblejaw","path":"/art/species/bramblejaw-256x256.png","size":"256x256","accent":"#5fce7a","family":"seedling","stage":"final"},
  {"set":"species","slug":"breezlet","name":"Breezlet","path":"/art/species/breezlet-1024x1024.png","size":"1024x1024","accent":"#9fd0ff","family":"breezlet","stage":"base"},
  {"set":"species","slug":"breezlet","name":"Breezlet","path":"/art/species/breezlet-256x256.png","size":"256x256","accent":"#9fd0ff","family":"breezlet","stage":"base"},
  {"set":"species","slug":"cindercub","name":"Cindercub","path":"/art/species/cindercub-1024x1024.png","size":"1024x1024","accent":"#ff6b4a","family":"cindercub","stage":"base"},
  {"set":"species","slug":"cindercub","name":"Cindercub","path":"/art/species/cindercub-256x256.png","size":"256x256","accent":"#ff6b4a","family":"cindercub","stage":"base"},
  {"set":"species","slug":"cinderpyre","name":"Cinderpyre","path":"/art/species/cinderpyre-1024x1024.png","size":"1024x1024","accent":"#ff6b4a","family":"cindercub","stage":"mid"},
  {"set":"species","slug":"cinderpyre","name":"Cinderpyre","path":"/art/species/cinderpyre-256x256.png","size":"256x256","accent":"#ff6b4a","family":"cindercub","stage":"mid"},
  {"set":"species","slug":"coalcrawl","name":"Coalcrawl","path":"/art/species/coalcrawl-1024x1024.png","size":"1024x1024","accent":"#ff6b4a","family":"coalcrawl","stage":"base"},
  {"set":"species","slug":"coalcrawl","name":"Coalcrawl","path":"/art/species/coalcrawl-256x256.png","size":"256x256","accent":"#ff6b4a","family":"coalcrawl","stage":"base"},
  {"set":"species","slug":"cragmaw","name":"Cragmaw","path":"/art/species/cragmaw-1024x1024.png","size":"1024x1024","accent":"#c9a06b","family":"pebblit","stage":"final"},
  {"set":"species","slug":"cragmaw","name":"Cragmaw","path":"/art/species/cragmaw-256x256.png","size":"256x256","accent":"#c9a06b","family":"pebblit","stage":"final"},
  {"set":"species","slug":"dawnfawn","name":"Dawnfawn","path":"/art/species/dawnfawn-1024x1024.png","size":"1024x1024","accent":"#ffe59e","family":"dawnfawn","stage":"mid"},
  {"set":"species","slug":"dawnfawn","name":"Dawnfawn","path":"/art/species/dawnfawn-256x256.png","size":"256x256","accent":"#ffe59e","family":"dawnfawn","stage":"mid"},
  {"set":"species","slug":"driftwisp","name":"Driftwisp","path":"/art/species/driftwisp-1024x1024.png","size":"1024x1024","accent":"#9fd0ff","family":"driftwisp","stage":"mid"},
  {"set":"species","slug":"driftwisp","name":"Driftwisp","path":"/art/species/driftwisp-256x256.png","size":"256x256","accent":"#9fd0ff","family":"driftwisp","stage":"mid"},
  {"set":"species","slug":"duskmoth","name":"Duskmoth","path":"/art/species/duskmoth-1024x1024.png","size":"1024x1024","accent":"#9a7bd6","family":"duskmoth","stage":"mid"},
  {"set":"species","slug":"duskmoth","name":"Duskmoth","path":"/art/species/duskmoth-256x256.png","size":"256x256","accent":"#9a7bd6","family":"duskmoth","stage":"mid"},
  {"set":"species","slug":"ferralit","name":"Ferralit","path":"/art/species/ferralit-1024x1024.png","size":"1024x1024","accent":"#c9a06b","family":"oreling","stage":"final"},
  {"set":"species","slug":"ferralit","name":"Ferralit","path":"/art/species/ferralit-256x256.png","size":"256x256","accent":"#c9a06b","family":"oreling","stage":"final"},
  {"set":"species","slug":"finnling","name":"Finnling","path":"/art/species/finnling-1024x1024.png","size":"1024x1024","accent":"#4aa8ff","family":"finnling","stage":"base"},
  {"set":"species","slug":"finnling","name":"Finnling","path":"/art/species/finnling-256x256.png","size":"256x256","accent":"#4aa8ff","family":"finnling","stage":"base"},
  {"set":"species","slug":"flarelynx","name":"Flarelynx","path":"/art/species/flarelynx-1024x1024.png","size":"1024x1024","accent":"#ff6b4a","family":"cindercub","stage":"final"},
  {"set":"species","slug":"flarelynx","name":"Flarelynx","path":"/art/species/flarelynx-256x256.png","size":"256x256","accent":"#ff6b4a","family":"cindercub","stage":"final"},
  {"set":"species","slug":"frostkit","name":"Frostkit","path":"/art/species/frostkit-1024x1024.png","size":"1024x1024","accent":"#8ee7ff","family":"frostkit","stage":"base"},
  {"set":"species","slug":"frostkit","name":"Frostkit","path":"/art/species/frostkit-256x256.png","size":"256x256","accent":"#8ee7ff","family":"frostkit","stage":"base"},
  {"set":"species","slug":"galestrike","name":"Galestrike","path":"/art/species/galestrike-1024x1024.png","size":"1024x1024","accent":"#9fd0ff","family":"breezlet","stage":"final"},
  {"set":"species","slug":"galestrike","name":"Galestrike","path":"/art/species/galestrike-256x256.png","size":"256x256","accent":"#9fd0ff","family":"breezlet","stage":"final"},
  {"set":"species","slug":"glacielle","name":"Glacielle","path":"/art/species/glacielle-1024x1024.png","size":"1024x1024","accent":"#8ee7ff","family":"frostkit","stage":"mid"},
  {"set":"species","slug":"glacielle","name":"Glacielle","path":"/art/species/glacielle-256x256.png","size":"256x256","accent":"#8ee7ff","family":"frostkit","stage":"mid"},
  {"set":"species","slug":"gleamoth","name":"Gleamoth","path":"/art/species/gleamoth-1024x1024.png","size":"1024x1024","accent":"#ffe59e","family":"gleamoth","stage":"base"},
  {"set":"species","slug":"gleamoth","name":"Gleamoth","path":"/art/species/gleamoth-256x256.png","size":"256x256","accent":"#ffe59e","family":"gleamoth","stage":"base"},
  {"set":"species","slug":"hearthmane","name":"Hearthmane","path":"/art/species/hearthmane-1024x1024.png","size":"1024x1024","accent":"#ff6b4a","family":"cindercub","stage":"final"},
  {"set":"species","slug":"hearthmane","name":"Hearthmane","path":"/art/species/hearthmane-256x256.png","size":"256x256","accent":"#ff6b4a","family":"cindercub","stage":"final"},
  {"set":"species","slug":"joltmouse","name":"Joltmouse","path":"/art/species/joltmouse-1024x1024.png","size":"1024x1024","accent":"#ffd23f","family":"joltmouse","stage":"base"},
  {"set":"species","slug":"joltmouse","name":"Joltmouse","path":"/art/species/joltmouse-256x256.png","size":"256x256","accent":"#ffd23f","family":"joltmouse","stage":"base"},
  {"set":"species","slug":"lumitide","name":"Lumitide","path":"/art/species/lumitide-1024x1024.png","size":"1024x1024","accent":"#4aa8ff","family":"tidepup","stage":"final"},
  {"set":"species","slug":"lumitide","name":"Lumitide","path":"/art/species/lumitide-256x256.png","size":"256x256","accent":"#4aa8ff","family":"tidepup","stage":"final"},
  {"set":"species","slug":"maelhound","name":"Maelhound","path":"/art/species/maelhound-1024x1024.png","size":"1024x1024","accent":"#4aa8ff","family":"tidepup","stage":"final"},
  {"set":"species","slug":"maelhound","name":"Maelhound","path":"/art/species/maelhound-256x256.png","size":"256x256","accent":"#4aa8ff","family":"tidepup","stage":"final"},
  {"set":"species","slug":"magmaw","name":"Magmaw","path":"/art/species/magmaw-1024x1024.png","size":"1024x1024","accent":"#ff6b4a","family":"coalcrawl","stage":"final"},
  {"set":"species","slug":"magmaw","name":"Magmaw","path":"/art/species/magmaw-256x256.png","size":"256x256","accent":"#ff6b4a","family":"coalcrawl","stage":"final"},
  {"set":"species","slug":"mistling","name":"Mistling","path":"/art/species/mistling-1024x1024.png","size":"1024x1024","accent":"#4aa8ff","family":"mistling","stage":"mid"},
  {"set":"species","slug":"mistling","name":"Mistling","path":"/art/species/mistling-256x256.png","size":"256x256","accent":"#4aa8ff","family":"mistling","stage":"mid"},
  {"set":"species","slug":"mossbug","name":"Mossbug","path":"/art/species/mossbug-1024x1024.png","size":"1024x1024","accent":"#5fce7a","family":"mossbug","stage":"base"},
  {"set":"species","slug":"mossbug","name":"Mossbug","path":"/art/species/mossbug-256x256.png","size":"256x256","accent":"#5fce7a","family":"mossbug","stage":"base"},
  {"set":"species","slug":"nocthound","name":"Nocthound","path":"/art/species/nocthound-1024x1024.png","size":"1024x1024","accent":"#9a7bd6","family":"shadepup","stage":"mid"},
  {"set":"species","slug":"nocthound","name":"Nocthound","path":"/art/species/nocthound-256x256.png","size":"256x256","accent":"#9a7bd6","family":"shadepup","stage":"mid"},
  {"set":"species","slug":"nyxaroth","name":"Nyxaroth","path":"/art/species/nyxaroth-1024x1024.png","size":"1024x1024","accent":"#9a7bd6","family":"nyxaroth","stage":"apex"},
  {"set":"species","slug":"nyxaroth","name":"Nyxaroth","path":"/art/species/nyxaroth-256x256.png","size":"256x256","accent":"#9a7bd6","family":"nyxaroth","stage":"apex"},
  {"set":"species","slug":"oreling","name":"Oreling","path":"/art/species/oreling-1024x1024.png","size":"1024x1024","accent":"#c9a06b","family":"oreling","stage":"base"},
  {"set":"species","slug":"oreling","name":"Oreling","path":"/art/species/oreling-256x256.png","size":"256x256","accent":"#c9a06b","family":"oreling","stage":"base"},
  {"set":"species","slug":"pebblit","name":"Pebblit","path":"/art/species/pebblit-1024x1024.png","size":"1024x1024","accent":"#c9a06b","family":"pebblit","stage":"base"},
  {"set":"species","slug":"pebblit","name":"Pebblit","path":"/art/species/pebblit-256x256.png","size":"256x256","accent":"#c9a06b","family":"pebblit","stage":"base"},
  {"set":"species","slug":"radimoth","name":"Radimoth","path":"/art/species/radimoth-1024x1024.png","size":"1024x1024","accent":"#ffe59e","family":"gleamoth","stage":"final"},
  {"set":"species","slug":"radimoth","name":"Radimoth","path":"/art/species/radimoth-256x256.png","size":"256x256","accent":"#ffe59e","family":"gleamoth","stage":"final"},
  {"set":"species","slug":"razorfin","name":"Razorfin","path":"/art/species/razorfin-1024x1024.png","size":"1024x1024","accent":"#4aa8ff","family":"finnling","stage":"final"},
  {"set":"species","slug":"razorfin","name":"Razorfin","path":"/art/species/razorfin-256x256.png","size":"256x256","accent":"#4aa8ff","family":"finnling","stage":"final"},
  {"set":"species","slug":"seedling","name":"Seedling","path":"/art/species/seedling-1024x1024.png","size":"1024x1024","accent":"#5fce7a","family":"seedling","stage":"base"},
  {"set":"species","slug":"seedling","name":"Seedling","path":"/art/species/seedling-256x256.png","size":"256x256","accent":"#5fce7a","family":"seedling","stage":"base"},
  {"set":"species","slug":"shadepup","name":"Shadepup","path":"/art/species/shadepup-1024x1024.png","size":"1024x1024","accent":"#9a7bd6","family":"shadepup","stage":"base"},
  {"set":"species","slug":"shadepup","name":"Shadepup","path":"/art/species/shadepup-256x256.png","size":"256x256","accent":"#9a7bd6","family":"shadepup","stage":"base"},
  {"set":"species","slug":"skywisp","name":"Skywisp","path":"/art/species/skywisp-1024x1024.png","size":"1024x1024","accent":"#9fd0ff","family":"breezlet","stage":"mid"},
  {"set":"species","slug":"skywisp","name":"Skywisp","path":"/art/species/skywisp-256x256.png","size":"256x256","accent":"#9fd0ff","family":"breezlet","stage":"mid"},
  {"set":"species","slug":"snowseal","name":"Snowseal","path":"/art/species/snowseal-1024x1024.png","size":"1024x1024","accent":"#8ee7ff","family":"snowseal","stage":"base"},
  {"set":"species","slug":"snowseal","name":"Snowseal","path":"/art/species/snowseal-256x256.png","size":"256x256","accent":"#8ee7ff","family":"snowseal","stage":"base"},
  {"set":"species","slug":"solaris","name":"Solaris","path":"/art/species/solaris-1024x1024.png","size":"1024x1024","accent":"#ffe59e","family":"solaris","stage":"apex"},
  {"set":"species","slug":"solaris","name":"Solaris","path":"/art/species/solaris-256x256.png","size":"256x256","accent":"#ffe59e","family":"solaris","stage":"apex"},
  {"set":"species","slug":"sporeling","name":"Sporeling","path":"/art/species/sporeling-1024x1024.png","size":"1024x1024","accent":"#5fce7a","family":"sporeling","stage":"mid"},
  {"set":"species","slug":"sporeling","name":"Sporeling","path":"/art/species/sporeling-256x256.png","size":"256x256","accent":"#5fce7a","family":"sporeling","stage":"mid"},
  {"set":"species","slug":"stormcrow","name":"Stormcrow","path":"/art/species/stormcrow-1024x1024.png","size":"1024x1024","accent":"#ffd23f","family":"zaplet","stage":"final"},
  {"set":"species","slug":"stormcrow","name":"Stormcrow","path":"/art/species/stormcrow-256x256.png","size":"256x256","accent":"#ffd23f","family":"zaplet","stage":"final"},
  {"set":"species","slug":"thornling","name":"Thornling","path":"/art/species/thornling-1024x1024.png","size":"1024x1024","accent":"#5fce7a","family":"seedling","stage":"mid"},
  {"set":"species","slug":"thornling","name":"Thornling","path":"/art/species/thornling-256x256.png","size":"256x256","accent":"#5fce7a","family":"seedling","stage":"mid"},
  {"set":"species","slug":"tidalhound","name":"Tidalhound","path":"/art/species/tidalhound-1024x1024.png","size":"1024x1024","accent":"#4aa8ff","family":"tidepup","stage":"mid"},
  {"set":"species","slug":"tidalhound","name":"Tidalhound","path":"/art/species/tidalhound-256x256.png","size":"256x256","accent":"#4aa8ff","family":"tidepup","stage":"mid"},
  {"set":"species","slug":"tidalrus","name":"Tidalrus","path":"/art/species/tidalrus-1024x1024.png","size":"1024x1024","accent":"#8ee7ff","family":"snowseal","stage":"final"},
  {"set":"species","slug":"tidalrus","name":"Tidalrus","path":"/art/species/tidalrus-256x256.png","size":"256x256","accent":"#8ee7ff","family":"snowseal","stage":"final"},
  {"set":"species","slug":"tidepup","name":"Tidepup","path":"/art/species/tidepup-1024x1024.png","size":"1024x1024","accent":"#4aa8ff","family":"tidepup","stage":"base"},
  {"set":"species","slug":"tidepup","name":"Tidepup","path":"/art/species/tidepup-256x256.png","size":"256x256","accent":"#4aa8ff","family":"tidepup","stage":"base"},
  {"set":"species","slug":"umbrawulf","name":"Umbrawulf","path":"/art/species/umbrawulf-1024x1024.png","size":"1024x1024","accent":"#9a7bd6","family":"shadepup","stage":"final"},
  {"set":"species","slug":"umbrawulf","name":"Umbrawulf","path":"/art/species/umbrawulf-256x256.png","size":"256x256","accent":"#9a7bd6","family":"shadepup","stage":"final"},
  {"set":"species","slug":"voltrat","name":"Voltrat","path":"/art/species/voltrat-1024x1024.png","size":"1024x1024","accent":"#ffd23f","family":"joltmouse","stage":"final"},
  {"set":"species","slug":"voltrat","name":"Voltrat","path":"/art/species/voltrat-256x256.png","size":"256x256","accent":"#ffd23f","family":"joltmouse","stage":"final"},
  {"set":"species","slug":"zaplet","name":"Zaplet","path":"/art/species/zaplet-1024x1024.png","size":"1024x1024","accent":"#ffd23f","family":"zaplet","stage":"base"},
  {"set":"species","slug":"zaplet","name":"Zaplet","path":"/art/species/zaplet-256x256.png","size":"256x256","accent":"#ffd23f","family":"zaplet","stage":"base"},
  {"set":"title","slug":"capsule","name":"Emberkin","path":"/art/title/capsule-1600x640.png","size":"1600x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"title","slug":"hero","name":"Emberkin","path":"/art/title/hero-1920x768.png","size":"1920x768","accent":"#e8622c","family":null,"stage":null},
  {"set":"title","slug":"mark","name":"Emberkin","path":"/art/title/mark-1024x1024.png","size":"1024x1024","accent":"#e8622c","family":null,"stage":null},
  {"set":"title","slug":"og","name":"Emberkin","path":"/art/title/og-1200x630.png","size":"1200x630","accent":"#e8622c","family":null,"stage":null},
  {"set":"title","slug":"og","name":"Emberkin","path":"/art/title/og-1200x640-asdelivered.png","size":"1200x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"title","slug":"social","name":"Emberkin","path":"/art/title/social-1280x640.png","size":"1280x640","accent":"#e8622c","family":null,"stage":null},
  {"set":"title","slug":"wordmark","name":"Emberkin","path":"/art/title/wordmark-1024x384.png","size":"1024x384","accent":"#e8622c","family":null,"stage":null},
  {"set":"types","slug":"ember","name":"ember","path":"/art/types/ember-512x512.png","size":"512x512","accent":"#ff6b4a","family":null,"stage":null},
  {"set":"types","slug":"frost","name":"frost","path":"/art/types/frost-512x512.png","size":"512x512","accent":"#8ee7ff","family":null,"stage":null},
  {"set":"types","slug":"gale","name":"gale","path":"/art/types/gale-512x512.png","size":"512x512","accent":"#9fd0ff","family":null,"stage":null},
  {"set":"types","slug":"lumen","name":"lumen","path":"/art/types/lumen-512x512.png","size":"512x512","accent":"#ffe59e","family":null,"stage":null},
  {"set":"types","slug":"spark","name":"spark","path":"/art/types/spark-512x512.png","size":"512x512","accent":"#ffd23f","family":null,"stage":null},
  {"set":"types","slug":"stone","name":"stone","path":"/art/types/stone-512x512.png","size":"512x512","accent":"#c9a06b","family":null,"stage":null},
  {"set":"types","slug":"tide","name":"tide","path":"/art/types/tide-512x512.png","size":"512x512","accent":"#4aa8ff","family":null,"stage":null},
  {"set":"types","slug":"umbra","name":"umbra","path":"/art/types/umbra-512x512.png","size":"512x512","accent":"#9a7bd6","family":null,"stage":null},
  {"set":"types","slug":"verdant","name":"verdant","path":"/art/types/verdant-512x512.png","size":"512x512","accent":"#5fce7a","family":null,"stage":null},
  {"set":"ui","slug":"frame-battle-hud","name":"Battle HUD plate","path":"/art/ui/frame-battle-hud-1024x512.png","size":"1024x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"frame-button","name":"Button plate","path":"/art/ui/frame-button-512x256.png","size":"512x256","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"frame-dialogue","name":"Dialogue frame","path":"/art/ui/frame-dialogue-1024x512.png","size":"1024x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"frame-portrait","name":"Portrait frame","path":"/art/ui/frame-portrait-768x1024.png","size":"768x1024","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"glyph-dex","name":"Dex","path":"/art/ui/glyph-dex-512x512.png","size":"512x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"glyph-party","name":"Party","path":"/art/ui/glyph-party-512x512.png","size":"512x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"glyph-resonance","name":"Resonance","path":"/art/ui/glyph-resonance-512x512.png","size":"512x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"glyph-satchel","name":"Satchel","path":"/art/ui/glyph-satchel-512x512.png","size":"512x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"glyph-shard","name":"Shard","path":"/art/ui/glyph-shard-512x512.png","size":"512x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"glyph-sync","name":"Sync","path":"/art/ui/glyph-sync-512x512.png","size":"512x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"glyph-temperament-ferocity","name":"Ferocity","path":"/art/ui/glyph-temperament-ferocity-512x512.png","size":"512x512","accent":"#e8622c","family":null,"stage":null},
  {"set":"ui","slug":"glyph-temperament-harmony","name":"Harmony","path":"/art/ui/glyph-temperament-harmony-512x512.png","size":"512x512","accent":"#e8622c","family":null,"stage":null},
]
