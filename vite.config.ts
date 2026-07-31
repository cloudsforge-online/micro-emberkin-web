import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * There is deliberately no `define`, no `envPrefix` and no `.env` file in this repository.
 *
 * A build-time constant is an environment baked into an image, and an image with an environment
 * baked into it has to be rebuilt to be promoted — which means the artefact that reaches
 * production is not the artefact that passed CI. Every host this app talks to is resolved at
 * RUNTIME from `window.location.hostname`, so one image serves localhost, staging, a preview
 * deployment and production. `test/no-build-time-config.test.ts` fails the build if
 * `import.meta.env.VITE_` ever reappears.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // @cloudsforge/ui is a `link:` dependency, so its own node_modules holds a second copy of
    // React. Two copies means two dispatchers, and the shared bar would throw on its first
    // useState.
    dedupe: ['react', 'react-dom'],
    alias: {
      // The carried-forward render layer was written for the buildless client's import map, where
      // `three/addons/` pointed at the CDN's `examples/jsm/`. The npm package puts them in the
      // same place, so this alias is the whole of what the move to a bundler cost those files —
      // their import statements are otherwise untouched, which is what "restructured, not
      // rewritten" is supposed to mean.
      'three/addons/': 'three/examples/jsm/',
    },
  },
  optimizeDeps: {
    // The linked package is shipped as TypeScript source until it is published; pre-bundling it
    // would freeze a stale copy of a package that is edited in the same working tree.
    exclude: ['@cloudsforge/ui'],
  },
  build: {
    // Named chunks and a real manifest of hashes: the assets are immutable-cached by nginx, and
    // that is only safe when every rebuild produces a new filename.
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Three gets its own chunk, by name.
         *
         * It is already lazy — only `src/game/stage.ts` imports it, and only `pages/play.tsx`
         * imports that — so this does not change WHEN it downloads. It changes what the build
         * output looks like: a chunk called `three-<hash>.js` is a number a reviewer can read
         * straight off `pnpm build`, and a renderer that started leaking into the entry chunk
         * would be visible as the entry chunk tripling rather than as a slow page nobody
         * profiled.
         */
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three'
          return undefined
        },
      },
    },
    // A game client's lazy renderer chunk is legitimately large; the default 500 kB warning would
    // fire on every build and be ignored, which is worse than a threshold set where it means
    // something. The entry chunk is what this repository actually watches, and
    // `test/bundle.test.ts` is what watches it.
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5195 },
  preview: { port: 5195 },
})
