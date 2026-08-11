# The Programmable Voice — design contract

The interface is a warm, hardback-inspired reading instrument: part literary history, part acoustic laboratory, with the evidence kept within reach.

## Visual system

- Warm paper, charcoal cloth and oxblood accents establish the physical-book metaphor in both light and dark themes.
- Newsreader for display and reading text; IBM Plex Mono for navigation, controls, labels, and evidence.
- Fine rules, restrained shadows, paper grain and spine gradients may explain material depth; decoration must never compete with the manuscript.
- A contained cover and a single two-page spread keep prose, figures and evidence legible. The settled interface never shows a third cover panel, translucent page copy or an inner reading scrollbar. Scientific figures use deterministic SVG and Canvas. Generated concept art may guide composition but is never presented as historical or scientific evidence.
- Oxblood labels distinguish evidence states, active narration and physical joins without turning the book into a dashboard.
- Motion reveals causality, including the opening cover and directional page turns, and stops when the reader changes section. Reduced-motion is a first-class state.

## Core states

- Opening: one fully contained cloth cover opens onto one title/prologue spread; the cover leaves the settled composition and the animated waveform remains an atmospheric, code-drawn motif.
- Reader: a calm two-page warm-paper spread with the chapter threshold on the left and a continuous, readable measure on the right. Navigation and evidence stay available without stealing page width.
- Laboratory: an open oscilloscope-like spread with exact controls, locally generated Web Audio, truthful A/B comparison and explicit demonstration limits.
- Recorded edition: pre-generated, checksum-addressed static narration with one persistent player, visible active passages and an unambiguous AI-generated disclosure. Playback never regenerates the voice.
- Companion leaves: A–D provide chronology, representation atlas, evidence method and the practical trust contract without being mistaken for numbered chapters.
- Mobile: safe-area aware, 44px targets, contents/evidence as modal sheets, no page-level overflow; the hardcover becomes a single paper page with document scrolling and persistent section navigation.
- Accessibility: keyboard page turns never steal keys from controls, text size and theme persist, figures carry text alternatives, narration is optional, and the complete manuscript remains available without JavaScript.

The concept references live in [`design/`](design/).
