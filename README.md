# The Programmable Voice

An interactive, evidence-led digital book about the material history of sound, music and the human voice—from vibrating air and ancient strings to records, telephones, computers and live machine conversation.

[**Open the live book**](https://the-programmable-voice.vercel.app)

## The edition

- A prologue, 30 long-form chapters, a six-mode Sound Laboratory and four companion leaves.
- More than 25,000 authored words, organised in layers for first-time readers, students and audio specialists.
- 205 unique primary records, scholarly works, standards, archives and explicitly dated vendor documents, cited at claim level.
- A code-drawn artefact atlas and scientific figures with text alternatives; generated concept art is never used as historical evidence.
- A hardback-inspired cover, warm-paper reading spreads, keyboard page turns, contents, search, adjustable text, reduced motion and a complete no-JavaScript manuscript.

## Recorded narration

Narration is a fixed audio edition, not a live voice session. The generation script sends each approved manuscript passage to the OpenAI Speech API once, trims only boundary silence, normalises it to the edition’s pinned loudness target, writes an MP3 addressed by the checksum of its final audio bytes, and performs pacing, loudness, true-peak, silence, checksum and full-decode checks. Playback fetches approved static files; it never asks a model to recreate the voice.

The provisional configuration uses pinned `gpt-4o-mini-tts-2025-12-15` output with the `shimmer` voice and detailed direction for one mature, warm modern Southern British woman’s reading. Because a model and voice name alone cannot establish gender presentation, accent or identity consistency, an equal-text candidate comparison and then a representative listening pilot are hard gates before full generation. The interface clearly discloses that the recording is AI-generated. A partial or subset-run manifest is rejected, so readers cannot accidentally hear a mixture of approved and missing passages.

The production key is required only while producing an edition and is never bundled, deployed to the browser or needed during playback.

## Run locally

Requirements: Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm install
npm run dev
```

The static manuscript is available at `/manuscript.html`.

## Produce the narration once

Audio generation also requires FFmpeg/ffprobe and a valid server-side `OPENAI_API_KEY`. The ordinary scripts use `ffmpeg` and `ffprobe` from `PATH` by default and accept absolute `FFMPEG_PATH` and `FFPROBE_PATH` overrides. The key must never be copied into the repository, downloaded from Vercel or exposed to a browser.

The canonical Vercel variable is Sensitive and Production-only, so use the disposable job runner from this already linked workspace. It validates the exact canonical project id, invokes a pinned Vercel CLI, stages version-controlled files plus an explicit allowlist of new application sources, and rejects secret-prone paths or live credential patterns. Pinned npm FFmpeg binaries are added only to the temporary tree. The runner creates a Production-target deployment with `--prod --skip-domain`; the canonical alias is never moved. The build returns only manifest-referenced narration audio and metadata in checksummed chunks. Before importing anything, the runner validates every path, inner/outer digest, size bound, edition, source, manuscript and passage identity. It then removes every deployment bearing that random job id and proves absence with a successful canonical-project query. It never runs `vercel link`, exports the key or prints it.

Inspect the non-mutating plan first:

```bash
npm run narration:vercel-job -- --pilot --dry-run
```

If the provisional speaker has not yet been accepted, generate the three-voice, equal-text British comparison. Listen to candidates A, B and C in full and select one only if it unmistakably meets the accent, adult-woman, warmth and cadence brief:

```bash
npm run narration:vercel-job -- --comparison
```

Set the selected built-in voice in `src/data/narrationEdition.ts` before generating the representative pilot. Reject all three and revise the comparison if none meets the brief; technical checks cannot certify accent or gender presentation.

First generate the representative voice pilot:

```bash
npm run narration:vercel-job -- --pilot
```

Listen to every pilot file listed in `.narration-work/pilot-manifest.json`. If—and only if—they sound like the same warm adult woman, with a natural contemporary Southern British accent, steady cadence, level and correct pronunciations, record that decision explicitly:

```bash
npm run narration:approve-pilot -- --approver="Editor name" --confirm-pilot-listened --confirm-same-woman --confirm-british-accent --confirm-warmth --confirm-cadence --confirm-level --confirm-pronunciations
```

Only then will the full production-target job run. It refuses to deploy unless the local generation state, pilot manifest, approved pilot digest and pilot audio all match the current manuscript:

```bash
npm run narration:vercel-job -- --full
```

The resumable generator stores immutable assets under `public/audio/narration/edition-2026-1/`, private generation state under `.narration-work/`, and an unapproved candidate manifest. Passage-specific pronunciation notes participate only in that passage’s digest. Direct `narration:generate -- --section=<id>` and `--limit=<number>` remain available in other trusted server environments for diagnostic runs, but any subset run is permanently marked incomplete and cannot be approved.

Disposable generation consumes OpenAI API usage and Vercel build resources. A complete edition is large and remains subject to the project’s build-duration and output limits. A remote timeout cannot return its new resumable state, so preserve every successfully imported `.narration-work` file and content-addressed MP3. The runner prints a random job id before deployment, catches SIGINT/SIGTERM, stops its active child process, and runs the same metadata-scoped cleanup in `finally`. A forced process kill or machine loss cannot run local cleanup; recover without guessing a deployment id using the printed command:

```bash
npm run narration:vercel-job -- --cleanup-job="paste the printed hexadecimal job id here"
```

Cleanup removes only deployments carrying that job id under the canonical linked project. Any failed removal or failed post-removal proof makes the command fail and must be resolved before retrying generation.

After a complete human listening and pronunciation pass, publish the release manifest explicitly:

```bash
npm run narration:approve -- --approver="Editor name" --confirm-listened --confirm-same-woman --confirm-british-accent --confirm-warmth --confirm-cadence --confirm-level --confirm-pronunciations --confirm-device-continuity --confirm-disclosure
npm run narration:verify
```

Only that approval step writes `public/audio/narration/manifest.json` and its content-addressed twin under `public/audio/narration/releases/`. A released edition cannot be replaced with different content under the same edition number; bump the edition instead. Commit the approved manifests and immutable audio assets, then deploy them as ordinary static files. Changing the manuscript, voice direction or pinned model invalidates the matching release and requires affected passages—and the complete listening approval—to be produced again.

Passage-sized files preserve exact paragraph highlighting and fine-grained saved-position recovery. The player reuses one audio element, prefetches the next passage and has automated ended-chain coverage. This design still requires the release checklist’s real-device Safari, iOS and background-playback continuity pass; it does not claim the sample files are intrinsically gapless section masters.

## Verify

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

`npm run check` runs linting, unit tests, full local FFmpeg media verification, TypeScript and the application build. Vercel’s ordinary `npm run build` uses `narration:verify-build`, which rechecks the approved release identity and every static-file checksum without assuming FFmpeg exists in the remote build image. Before narration production, `npm run build:app` is available for application-only QA. The browser suite covers the cover and page flow, static narration lifecycle, responsive layouts, accessibility, themes, evidence dialogs, laboratory controls and the no-JavaScript edition.

## Deploy to Vercel

Import the repository and deploy. `vercel.json` provides SPA routing and security headers; narration is served from versioned static assets and requires no runtime API function. Keep `OPENAI_API_KEY` server-only for future edition generation and never prefix it with `VITE_`.

## Licence

No project-wide licence has been selected yet. Public availability does not grant permission to reuse the code or manuscript. Bundled font licences are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
