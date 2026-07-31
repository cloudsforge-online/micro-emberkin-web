/**
 * The 3D battle stage — the only module in this repository that reaches Three.js.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS AT ALL, RATHER THAN THE PAGE IMPORTING `render/scene.js` DIRECTLY.
 *
 * Three, plus the four post-processing addons `render/scene.js` uses and the GLTFLoader, is by a
 * wide margin the largest thing in this dependency tree. `pages/play.tsx` is the only page that
 * needs it, and it reaches it through `import('./stage.ts')` at the bottom of a `lazy()` route —
 * so a player who opens the dex, the wardrobe or the settings downloads none of it.
 *
 * "It is a game client — performance is a feature", and the concrete version of that rule is: the
 * menus must not pay for the renderer. `test/bundle.test.ts` asserts that no module outside
 * `src/game/` mentions `three`, and the CI build reports the chunk sizes so a regression is
 * visible rather than merely forbidden.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * WHAT IT DELIBERATELY DOES NOT DO: decide anything about the battle. It takes an already-resolved
 * result from the server and plays it back. There is no engine here, no RNG, no damage number
 * computed in the browser. The upstream client had all three; they are deleted, and the shape of
 * this module is the reason it stays that way — it has no inputs from which a battle could be
 * derived, only a log to animate.
 */
import { CREATURE_BASE } from './assetbase.js'

/** A minimal view of the carried-forward render layer, typed at its edge. */
interface RenderLayer {
  Stage: new (canvas: HTMLCanvasElement) => StageInstance
  AssetLibrary: new (three: unknown) => AssetLibraryInstance
  createCreature: (three: unknown, species: unknown, visual: unknown, scene: unknown) => RigInstance | null
  Vfx: new (three: unknown, scene: unknown) => VfxInstance
  preloadProps: () => Promise<void>
  three: unknown
}

interface StageInstance {
  scene: unknown
  setBiome(regionId: string): void
  slotPosition(slot: 'player' | 'enemy'): unknown
  mountRig(rig: RigInstance, slot: 'player' | 'enemy'): void
  clearRigs(): void
  frameCamera(behind: 'player' | 'enemy', look: 'player' | 'enemy'): void
  shake(intensity?: number): void
  update(dt: number): void
  render(): void
  resize(): void
}

interface AssetLibraryInstance {
  preloadCreatures(ids: readonly string[], baseUrl: string): Promise<unknown>
  getCreatureScene(id: string): unknown
  hasCreature(id: string): boolean
}

interface RigInstance {
  update(dt: number): void
  faceToward(pos: unknown): void
  playAttack(target: unknown, onImpact: () => void): number
  playCast(onRelease: () => void): number
  playHit(): void
  playFaint(): void
  playVictory(): void
  dispose(): void
}

interface VfxInstance {
  impact(opts: { element: string; at: unknown; crit: boolean }): void
  update(dt: number): void
}

/**
 * Load the renderer.
 *
 * One dynamic import of one barrel, so Vite emits ONE lazy chunk rather than five that all have to
 * arrive before anything appears. `three` itself is imported here rather than left to the render
 * modules' own top-level imports, so that the instance handed to `createCreature` and `Vfx` — both
 * of which take it as a parameter, per `web/game/CONTRACT.md` — is provably the same one the stage
 * is drawing with. Two copies of Three in one scene is a class of bug that presents as objects
 * that exist and are never drawn.
 */
async function loadRenderLayer(): Promise<RenderLayer> {
  const [three, scene, assets, creatures, effects, environments] = await Promise.all([
    import('three'),
    import('./render/scene.js'),
    import('./render/assets.js'),
    import('./render/creatures.js'),
    import('./render/effects.js'),
    import('./render/environments.js'),
  ])
  return {
    Stage: (scene as { Stage: RenderLayer['Stage'] }).Stage,
    AssetLibrary: (assets as { AssetLibrary: RenderLayer['AssetLibrary'] }).AssetLibrary,
    createCreature: (creatures as { createCreature: RenderLayer['createCreature'] }).createCreature,
    Vfx: (effects as { Vfx: RenderLayer['Vfx'] }).Vfx,
    preloadProps: (environments as { preloadProps: RenderLayer['preloadProps'] }).preloadProps,
    three,
  }
}

export interface StageActor {
  readonly speciesId: string
  readonly species: unknown
  readonly visual: unknown
}

export interface BattleStageOptions {
  readonly canvas: HTMLCanvasElement
  readonly regionId: string
  readonly player: StageActor
  readonly enemy: StageActor
  /** When true the loop still runs but nothing lunges, shakes or flashes. See `setReducedMotion`. */
  readonly reducedMotion: boolean
}

/**
 * A mounted battle stage.
 *
 * `dispose()` is not optional housekeeping. A WebGL context is a finite browser resource — most
 * engines allow eight to sixteen per document and evict the oldest without warning — so a route
 * that mounts one per visit and never releases it makes the sixth battle of a session render
 * nothing at all. Every caller mounts in an effect and disposes in its cleanup.
 */
export interface BattleStage {
  setBiome(regionId: string): void
  /** Play one cue. Returns the seconds the caller should wait before the next beat. */
  play(cue: 'attack' | 'art' | 'faint' | 'catch' | 'critical' | 'miss' | 'hit' | 'victory'): number
  setReducedMotion(reduced: boolean): void
  dispose(): void
}

/**
 * Mount the stage.
 *
 * Rejects rather than half-succeeding when WebGL is unavailable: `pages/play.tsx` catches that and
 * renders the battle as its log, which is a complete and playable experience. A game that shows a
 * black rectangle on a machine without a GPU has chosen the worse of the two failures.
 */
export async function mountBattleStage(options: BattleStageOptions): Promise<BattleStage> {
  const layer = await loadRenderLayer()

  const stage = new layer.Stage(options.canvas)
  const library = new layer.AssetLibrary(layer.three)
  await Promise.all([
    library.preloadCreatures([options.player.speciesId, options.enemy.speciesId], CREATURE_BASE),
    layer.preloadProps(),
  ])
  stage.setBiome(options.regionId)

  const playerRig = layer.createCreature(
    layer.three,
    options.player.species,
    options.player.visual,
    library.getCreatureScene(options.player.speciesId),
  )
  const enemyRig = layer.createCreature(
    layer.three,
    options.enemy.species,
    options.enemy.visual,
    library.getCreatureScene(options.enemy.speciesId),
  )
  if (playerRig) stage.mountRig(playerRig, 'player')
  if (enemyRig) stage.mountRig(enemyRig, 'enemy')
  stage.frameCamera('player', 'enemy')

  const vfx = new layer.Vfx(layer.three, stage.scene)

  let reduced = options.reducedMotion
  let raf = 0
  let last = performance.now()
  let disposed = false

  const frame = (now: number) => {
    if (disposed) return
    // Clamped, because a backgrounded tab resumes with a delta of many seconds and every
    // animation in the layer integrates it — the first frame back would teleport a lunge to its
    // end and skip the impact callback with it.
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    stage.update(dt)
    playerRig?.update(dt)
    enemyRig?.update(dt)
    vfx.update(dt)
    stage.render()
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    setBiome: (regionId) => stage.setBiome(regionId),

    setReducedMotion: (value) => {
      reduced = value
    },

    play(cue) {
      // Reduced motion keeps the SCENE — the biome, the creatures, the lighting — and drops only
      // the movement: no lunge, no camera shake, no flash. The beat still costs its time so the
      // log advances at a readable pace rather than dumping twelve lines at once.
      if (reduced) return 0.35

      switch (cue) {
        case 'attack':
          return playerRig?.playAttack(stage.slotPosition('enemy'), () => {
            enemyRig?.playHit()
            vfx.impact({ element: 'ember', at: stage.slotPosition('enemy'), crit: false })
          }) ?? 0.35
        case 'art':
          return playerRig?.playCast(() => {
            vfx.impact({ element: 'lumen', at: stage.slotPosition('enemy'), crit: false })
          }) ?? 0.6
        case 'critical':
          stage.shake(0.6)
          vfx.impact({ element: 'ember', at: stage.slotPosition('enemy'), crit: true })
          return 0.4
        case 'hit':
          enemyRig?.playHit()
          return 0.3
        case 'faint':
          enemyRig?.playFaint()
          return 0.9
        case 'victory':
          playerRig?.playVictory()
          return 0.9
        case 'catch':
          return 0.8
        case 'miss':
          return 0.3
      }
    },

    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      stage.clearRigs()
      playerRig?.dispose()
      enemyRig?.dispose()
    },
  }
}
