/**
 * Is WebGL available at all?
 *
 * ITS OWN MODULE, ON PURPOSE. `pages/play.tsx` asks this question BEFORE deciding whether to
 * `import('./stage.ts')`, so a machine that cannot render never downloads a renderer it cannot
 * use. If it lived in `stage.ts`, importing it would statically import that module — Vite says so
 * out loud: "dynamically imported … but also statically imported … dynamic import will not move
 * module into another chunk" — and the lazy boundary this repository is built around would be
 * quietly undone by one convenient import.
 *
 * The probe context is released immediately. Browsers cap live WebGL contexts per document at
 * around eight to sixteen and evict the oldest without warning, so a probe that leaked one would
 * cost a real battle its renderer later in the session.
 */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return false
    const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return true
  } catch {
    return false
  }
}
