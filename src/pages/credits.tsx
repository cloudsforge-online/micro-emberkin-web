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
          We could not read the asset list out of this build, so there is no per-image record to
          show you. Everything said below about the pictures still stands: a model made all of
          them.
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
        <p className="ek-muted">Reading the asset list…</p>
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

      <h2>What is 3D and what is not</h2>
      <p>
        A model drew the <strong>flat art</strong>: the portraits, the element icons, the region
        paintings, the title lockup and the interface itself, which between them are most of what
        you look at. The creatures moving during a fight are a different matter. Those are built by
        code rather than sculpted by anyone, carried across from the game Emberkin grew out of, and
        their own art notes call them stand-ins.
      </p>
      <p>
        They are loaded through a boundary rather than wired into the game, which means proper
        models can be dropped in without anybody touching how the game plays. That is why this is
        an honest note about scope and not a rewrite waiting to happen.
      </p>

      <h2>The game</h2>
      <p>
        Emberkin comes out of KINDRED: Resonance, and keeps its work: the battle engine, the fifty
        species, the forty-seven moves, the nine elements, and the Resonance, Temperament and Sync
        system that ties them together. Fights are settled on the server from a seed, which is why
        a log replays move for move rather than approximately.
      </p>

      <h2>Where this sits</h2>
      <p>
        Emberkin is one title inside Forge Worlds. The account you play it with also walks into
        Tessera and Aetherholm, and it carries one inventory, one set of achievements and one
        season record between them. Nothing you win here is stranded in here.
      </p>
      {/*
        ── "EMBER CARRIES NO MONETARY VALUE" WAS TRUE WHEN IT WAS WRITTEN AND IS NOT NOW ─────────

        On 2026-08-10 at 19:13:30Z the operator set an administered rate for EMBER through
        `PUT /admin/prices/:asset`. Measured 2026-08-11, `GET /rates` answers EMBER with
        `source: "administered"` and `sourceCount: 0`, beside eleven assets answering `market` with
        `sourceCount: 4` — and hub prints a dollar figure against an EMBER balance. A player who
        reads "no monetary value" here and then meets that figure has been told two incompatible
        things by one company, and the number is the one they will believe (micro-org#365).

        The sentence is not deleted. Deleting it leaves a page that mentions a currency and says
        nothing about what it is worth, which is where this whole defect family starts. It is
        replaced by the pair the estate settled on: name the price, then say whose it is,
        immediately and in the same breath. `hub-web/src/components/estimate.tsx` renders that pair
        beside the figure; `network-site`'s standing notice says it to somebody deciding whether to
        mine; this says it to somebody who came to read the art credits and found a chain.

        Present tense and no schedule — "not yet listed" describes a date that does not exist — and
        no figure, because the number would be a fourth copy of an operator's decision sitting in a
        bundle behind a CDN, going stale the next time it is changed.

        The clause that did NOT move is the one that matters most on a games client: no market and
        no listing, so nothing a player wins here can be sold. That is asserted first.
      */}
      <p>
        Underneath all of it is Hearth, a chain that runs a real EVM. Solidity contracts deploy to
        it, and MetaMask, ethers, viem, Hardhat and Foundry work against it without special cases,
        because it is held to Ethereum&apos;s published test vectors. Its currency, EMBER, is what
        the wider ecosystem pays in, and you can mine it from a browser tab on a key that never
        leaves your machine. EMBER has no market and no listing, so nothing you win here can be
        sold. It does carry a price on CloudsForge screens, and that price is one we set ourselves
        rather than one anybody has paid for it. Nothing here is an offer to buy or sell anything.
      </p>
    </section>
  )
}
