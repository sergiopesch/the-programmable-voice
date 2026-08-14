# The Programmable Voice

An interactive, evidence-led digital book about the material history of sound, music and the human voice—from vibrating air and ancient strings to records, telephones, computers and live machine conversation.

[**Open the live book**](https://the-programmable-voice.vercel.app)

## The edition

- A prologue, 30 long-form chapters, a six-mode Sound Laboratory and four companion leaves.
- More than 25,000 authored words, written for first-time readers, students and audio specialists, with technical detail kept beside its evidence.
- More than 200 unique primary records, scholarly works, standards, archives and explicitly dated vendor documents, cited beside the evidential passage they support.
- A code-drawn artefact atlas and scientific figures with text alternatives; generated concept art is never used as historical evidence.
- A hardback-inspired cover, warm-paper reading spreads, keyboard page turns, contents, search, adjustable text, reduced motion and a complete no-JavaScript manuscript.

## Architecture

The supported application is a static React 19/Vite book. `src/data/` contains the manuscript, source catalogue and narration-edition contract; `src/App.tsx` owns hash-routed section state; `src/components/` renders the semantic cover, reading section, dialogs, evidence and Sound Laboratory; and `src/styles.css` owns the present cover and section-transition motion. Vite also emits the complete no-JavaScript edition at `/manuscript.html`.

The reader has no application server and does not synthesise speech. Narration is loaded from an immutable static manifest by `useNarrationPlayer`; the local Kokoro generation and review tools remain isolated under `scripts/` and `tools/narration/`.

`main` is the only supported product line. A 2026-08-14 uncommitted physical-book/WebGL experiment was preserved outside the repository for recovery, but it is not a build input, an alternate architecture or a feature branch. Reintroducing any part of it requires a fresh product and motion decision plus browser evidence.

## Recorded narration

Narration is a fixed AI-generated audio edition, not a live voice session. Each settled manuscript passage is synthesised once on the production machine, trimmed only at its outer boundaries, normalised to the pinned loudness target and written as a checksum-addressed static MP3. Generation and verification measure pacing, loudness, true peak, boundary silence and full decoding. Playback never runs a speech model.

Edition `2026.2` uses the British female voice `bf_emma` from `onnx-community/Kokoro-82M-v1.0-ONNX`, pinned to revision `1939ad2a8e416c0acfeecc08a694d14ef25f2231`, q8 inference and `kokoro-js@1.2.1`. Final files are 24 kHz mono MP3 at 48 kbps. The project owner selected Emma after listening to the exact diagnostic stored under `docs/narration/voice-selection/`; that decision approves the speaker only. It does not stand in for the representative-pilot listen or the complete in-order edition listen.

The model runs locally and needs no API credential. Its exact model, tokenizer and Emma voice files are checksum-pinned before inference. The synthesiser is isolated in the private `tools/narration/` package rather than installed in the root application dependency tree. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for model, runtime and phonemiser provenance.

## Run locally

Requirements: Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm ci
npm run dev
```

The static manuscript is available at `/manuscript.html`. Use `npm install` only when deliberately changing dependencies and refreshing `package-lock.json`.

## Produce the narration once

Audio generation requires FFmpeg/ffprobe. The scripts use `ffmpeg` and `ffprobe` from `PATH` by default and accept absolute `FFMPEG_PATH` and `FFPROBE_PATH` overrides. Install the pinned, generation-only runtime separately after the root application install:

```bash
npm ci --prefix tools/narration
```

The generator fails closed with that same instruction when the isolated runtime is absent. On first use it downloads only the four files required from the exact model revision into the ignored `.narration-work/models/` cache and verifies every configured SHA-256 digest. The isolated runtime version and bundled Emma voice vector are verified as well.

Generate the representative voice pilot locally:

```bash
npm run narration:pilot
```

The command writes 14 checksum-addressed 24 kHz / 48 kbps files under `public/audio/narration/edition-2026-2/` and a private `.narration-work/pilot-manifest.json`. Technical QC is not editorial approval. Listen to every listed file in full. If—and only if—the set sounds like the same warm British woman with suitable cadence, level and pronunciations, record that decision explicitly:

```bash
npm run narration:approve-pilot -- --approver="Editor name" --confirm-pilot-listened --confirm-same-woman --confirm-british-accent --confirm-warmth --confirm-cadence --confirm-level --confirm-pronunciations
```

Only then will complete generation run. It refuses to start unless the pilot manifest, approval digest, configuration, current pilot-passage digests and checksum-pinned pilot files all still match. Unrelated non-pilot manuscript edits do not erase an exact listening receipt:

```bash
npm run narration:generate
```

Generation is resumable: verified content-addressed files are reused and private state is persisted after each passage. Passage-specific pronunciation notes participate only in that passage’s digest. Diagnostic `--section=<id>` and `--limit=<number>` subsets are permanently marked incomplete and cannot become a release. The former OpenAI/Vercel generation path is retired; `bf_emma` is not an OpenAI voice and no OpenAI key is used or exported.

After a complete human listening and pronunciation pass, publish the release manifest explicitly:

```bash
npm run narration:approve -- --approver="Editor name" --confirm-listened --confirm-same-woman --confirm-british-accent --confirm-warmth --confirm-cadence --confirm-level --confirm-pronunciations --confirm-device-continuity --confirm-disclosure
npm run narration:verify
```

Only that approval step writes `public/audio/narration/manifest.json` and its content-addressed twin under `public/audio/narration/releases/`. Each release embeds the exact representative-pilot manifest and human approval, binds that receipt into the release identity and proves that the full edition retains those same audio bytes. A released edition cannot be replaced under the same edition number. Commit the approved manifests and immutable audio assets, then deploy them as ordinary static files. A manuscript, voice, model, runtime, speed or encoding change invalidates the matching release.

Passage-sized files preserve exact paragraph highlighting and fine-grained saved-position recovery. The player reuses one audio element, prefetches the next passage and has automated ended-chain coverage. This design still requires the release checklist’s real-device Safari, iOS and background-playback continuity pass; it does not claim the sample files are intrinsically gapless section masters.

## Verify

```bash
npx playwright install chromium
npm run check:app
npm run test:e2e
npm audit
git diff --check
```

`npm run check:app` is the complete pre-narration gate: linting, unit and job tests, TypeScript and the application build. The browser suite covers the cover and page flow, static narration lifecycle, responsive layouts, accessibility, themes, evidence dialogs, laboratory controls and the no-JavaScript edition. This repository has no hosted CI workflow, so contributors run these gates locally before delivery.

`npm run check` adds full local FFmpeg verification of a complete human-approved recorded edition and is therefore the narration release gate. It is expected to fail while the tracked manifest is incomplete or unapproved; do not weaken that failure to make a code change pass. Vercel’s ordinary `npm run build` uses `narration:verify-build`, which rechecks the approved release identity and every static-file checksum without assuming FFmpeg exists in the remote build image. `npm run build:app` remains available for a faster application-only build.

## Deploy to Vercel

Deploy the approved static release with the application. `vercel.json` provides SPA routing, security headers and immutable caching for edition `2026.2`; narration needs no runtime API function or credential. The 24 kHz / 48 kbps encoding is projected to fit the Hobby plan’s upload ceiling, but the final output must be measured rather than assumed.

Source deployment intentionally excludes `tools/` and all of `public/audio/narration/` through `.vercelignore`, so it cannot install or upload the generation runtime, stale recordings or unapproved recordings. For the final release, build from a clean checkout or worktree at the exact approved Git SHA, run `vercel build --prod`, and prove the complete `.vercel/output` is below 100 MB. Stage it without moving the production alias using `vercel deploy --prebuilt --archive=tgz --prod --skip-domain`; at the unique deployment URL, verify READY status, Git/build metadata, the immutable manifest and every referenced audio asset. Only then promote that exact deployment with `vercel promote <deployment-url>`. Abort if the manifest, checksums, clean SHA or measured size differs from the approved release.

## Licence

No project-wide licence has been selected yet. Public availability does not grant permission to reuse the code or manuscript. Bundled font licences are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
