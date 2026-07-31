/**
 * Credits: where the art came from, said plainly.
 *
 * Every image in this client is AI-generated, and the manifest that ships with them says so. That
 * disclosure is not something a client should paraphrase, so this page FETCHES
 * `/art/MANIFEST.json` and renders the manifest's own words — the disclosure, the licence, the
 * model, the counts. 776 KB, fetched only by a reader who asked; the catalogue the rest of the app
 * uses is a 24 KB derivative with the prompts stripped out.
 *
 * The 2D/3D distinction is stated here too, because it is the one thing about this repository most
 * likely to be misread. FLUX produced 2D. The creature models are the procedural glTF bakes
 * carried forward from `kindred-resonance`, and nothing here implies otherwise.
 */
import { useEffect, useState } from 'react'
import { titleArt } from '../lib/art.ts'
import { ART } from '../art/catalogue.ts'

interface Manifest {
  generator?: string
  endpoint?: string
  specification?: string
  disclosure?: string
  licence?: string
  assetCount?: number
  updatedAt?: string
}

export function CreditsPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [failed, setFailed] = useState(false)
  const wordmark = titleArt('wordmark')

  useEffect(() => {
    let live = true
    fetch('/art/MANIFEST.json', { credentials: 'omit' })
      .then((res) => (res.ok ? (res.json() as Promise<Manifest>) : Promise.reject(new Error(String(res.status)))))
      .then((m) => live && setManifest(m))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  const bySet = new Map<string, number>()
  for (const entry of ART) bySet.set(entry.set, (bySet.get(entry.set) ?? 0) + 1)

  return (
    <section className="ek-page">
      {wordmark ? <img className="ek-credits__wordmark" src={wordmark} alt="Emberkin" width={512} height={192} /> : null}
      <h1>Credits and provenance</h1>

      <h2>The art</h2>
      {failed ? (
        <p>
          The asset manifest could not be read from this build, so the per-image provenance is not
          available here. What is stated below about the images still holds: every one of them was
          generated.
        </p>
      ) : manifest ? (
        <>
          <p>{manifest.disclosure}</p>
          <dl className="ek-credits__meta">
            <dt>Generator</dt>
            <dd>{manifest.generator}</dd>
            <dt>Specification</dt>
            <dd>{manifest.specification}</dd>
            <dt>Licence</dt>
            <dd>{manifest.licence}</dd>
            <dt>Assets</dt>
            <dd className="cf-num">{manifest.assetCount}</dd>
            <dt>Generated</dt>
            <dd>{manifest.updatedAt}</dd>
          </dl>
        </>
      ) : (
        <p className="ek-muted">Reading the manifest…</p>
      )}

      <ul className="ek-credits__sets">
        {[...bySet.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([set, count]) => (
            <li key={set}>
              <strong>{set}</strong> — <span className="cf-num">{count}</span> files
            </li>
          ))}
      </ul>

      <h2>The 3D, stated honestly</h2>
      <p>
        The image generator produced <strong>two-dimensional art</strong>: portraits, type icons,
        region keyart, the title lockup and the interface chrome — which is most of what you read
        while playing. The creature models you see in a battle are <strong>not</strong> generated.
        They are the procedural glTF bakes carried forward from the game this client is descended
        from, built from code rather than sculpted, and they remain placeholders by their own art
        bible's admission.
      </p>
      <p>
        The rendering layer loads them through an asset seam rather than building them inline, so
        real models can replace them later without touching a line of gameplay code. That seam is
        the reason the caveat is a scope note rather than a rewrite waiting to happen.
      </p>

      <h2>The game</h2>
      <p>
        Emberkin is descended from KINDRED: Resonance. The battle engine, the fifty species, the
        forty-seven moves, the nine elements and the Resonance / Temperament / Sync system are its
        design, ported and kept. Battles are resolved by the server from a seed, so a battle log
        replays exactly.
      </p>
    </section>
  )
}
