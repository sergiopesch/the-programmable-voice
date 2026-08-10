# The Programmable Voice — design contract

The interface is a monochrome editorial instrument: part literary history, part oscilloscope.

## Visual system

- True white `#fff` and true black `#000`; neutral greys come only from opacity.
- Newsreader for display and reading text; IBM Plex Mono for navigation, controls, labels, and evidence.
- Square corners, 1px rules, no gradients, shadows, glows, colour, pills, badges, or decorative cards.
- Open rails and book-spread composition. Scientific figures use deterministic SVG and Canvas, never generated art.
- Motion reveals causality and stops when the reader changes section. Reduced-motion is a first-class state.

## Core states

- Opening: monumental title plus animated waveform and chapter rail.
- Reader: progress rail, 65–75 character measure, integrated scientific figure, evidence rail.
- Laboratory: open oscilloscope, exact controls, locally generated Web Audio, A/B comparison.
- Mobile: safe-area aware, 44px targets, contents/evidence as modal sheets, no page-level overflow.

The concept references live in [`design/`](design/).
