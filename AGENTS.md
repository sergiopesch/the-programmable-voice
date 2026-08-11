# The Programmable Voice — working agreement

This repository is an evidence-led interactive book, not a product landing page. It follows how people have represented, preserved, transmitted and reconstructed sound, music and voice, and asks at every threshold what survived, what was lost and who gained control. The intended audience ranges from teenagers and first-time readers to teachers, students and specialists.

Before changing the book, inspect the relevant manuscript, source entries, design contract, tests and narration configuration. Preserve unrelated work and the unreleased audio under `public/audio/`.

## Four-team editorial loop

Treat substantial work as four linked reviews. Delegate recursively when parallel capacity is available, then bring every finding back through the same gates.

1. **Documentary and futures** establishes what may be said.
2. **Story and structure** decides how a reader encounters it.
3. **UI, UX and motion** decides how that hierarchy behaves on a real device.
4. **British-English narration** decides how the approved words are heard.

No later team may silently broaden an earlier team’s claim. A visually elegant or narratively satisfying line still needs the right evidence; narration is produced only from the settled manuscript.

## Documentary and futures gate

- Prefer primary records for what a patent, standard, instrument, archive or participant actually records; use scholarly histories for significance, context and contested priority.
- Bind every source to the exact claim it supports. Opening a source is part of verification: a plausible title, remembered quotation or secondary citation is not enough.
- Define the criterion before using *first*, *invented* or *began*. Patent, filing, demonstration, operation, publication, adoption and cultural influence answer different questions.
- Keep the history polycentric. Test whether institutions, workers, colonised markets, disabled people, women, oral traditions and non-English-speaking communities appear as agents rather than scenery.
- Date unstable present-day claims and distinguish official documentation, vendor disclosure, preprint, peer review, inference and the book’s own thesis.
- Keep source genre (`SourceType`) separate from the visible claim posture (`EpistemicLabel`). A primary paper may support a historical reconstruction; the label describes the claim the reader is being asked to accept.
- Maintain a claim ledger as the next provenance layer: stable claim ID or sentence, source locator, evidence relationship, scope, confidence, document version and access date. Do not call block-level citation “claim-level”.
- Frame futures as `Conditional projection`, never prophecy. Record the as-of date, horizon, population and region; historical reference class; observed signals versus inferred mechanism; enabling conditions; bottlenecks across capability, cost/latency, infrastructure, institutions, adoption and rights; constrained/base/accelerated branches; confidence and rationale; indicators, falsifiers, review date and owner. Use ranges or branches where evidence cannot justify a point estimate.

## Story and structure gate

- The recurring spine is **representation → preservation → loss → power → reconstruction**. A chapter should advance that inquiry, not merely add chronology.
- Let a concrete human or sensory scene create the question, then make the mechanism lucid, then offer the deeper evidential layer. Do not make all three layers feel equally compulsory.
- Vary chapter rhythm and endings. The repeated scene/question/explanation/callout pattern is a tool, not a template for every chapter.
- Keep caveats close enough to prevent error, but move methodological repetition into the evidence layer when the main story already states the boundary honestly.
- Explain technical terms at first use in ordinary language. Preserve precision for specialists without making younger or first-time readers climb a wall of terminology.
- Draw on broad qualities of excellent literary non-fiction—clarity, restraint, surprise, rhythm and attention—without imitating a living writer’s distinctive voice.

## UI, UX and motion gate

- Follow `DESIGN.md`: one contained hardback cover, one settled two-page spread, one paper leaf on mobile. Never reintroduce a ghosted cover, clipped billboard title, red slab, third panel or inner reading scrollbar.
- Test the state that will ship, including a valid released-narration manifest. An unreleased placeholder alone cannot reveal player contrast, occlusion or mobile-landscape failures.
- Motion must explain opening, direction, causality or state. Stop it when the section changes and provide an equally coherent reduced-motion state.
- Keep reading order, focus, evidence, controls and status available by keyboard and assistive technology. Maintain 44-pixel targets, safe areas, visible focus and no document overflow at the tested viewport matrix.
- Generated concept art may inform composition only. Historical and scientific evidence remains sourced prose, deterministic SVG or Canvas, and labelled demonstrations.

## British-English narration gate

- Narration is a fixed, AI-generated recorded edition. Playback never generates speech live and must always disclose that the voice is not human.
- The stale `marin` and `coral` pilots were rejected and are not approval precedents. The project owner selected Kokoro `bf_emma` after hearing the checksum-pinned diagnostic under `docs/narration/voice-selection/`. That receipt approves the speaker identity only; the production-config representative pilot and complete edition still require their separate human listening gates.
- A voice name and prompt cannot certify accent, age or gender presentation. For edition `2026.2`, the tracked, checksum-pinned Emma diagnostic and explicit project-owner instruction satisfy the candidate-selection gate; they do not satisfy the representative-pilot gate. Require, in order: that exact selection receipt; representative pilot approval; complete generation; full in-order human listen; pronunciation, level, continuity and disclosure approval; immutable release manifest. A changed voice, model, runtime, speed or selection sample requires a new candidate-selection decision.
- Read the manuscript exactly. Put pronunciation guidance on individual passages so a correction invalidates only the affected recording.
- Do not release partial, mixed, stale or merely technically valid audio. Technical QC complements human editorial listening; it does not replace it.

## Required validation

Use the narrowest check while editing, then finish substantial application work with:

```bash
npm run check:app
npm run test:e2e
git diff --check
```

`npm run check:app` is the pre-narration application gate. `npm run check` is the release gate and is expected to fail until a complete human-approved narration manifest exists. A manuscript or narration-configuration change invalidates narration identity and requires fresh comparison or approval artefacts as appropriate.
