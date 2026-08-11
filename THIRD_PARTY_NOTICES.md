# Third-party notices

The production build bundles the following fonts through Fontsource packages:

- **Newsreader**, copyright 2020 The Newsreader Project Authors, via `@fontsource-variable/newsreader`.
- **IBM Plex Mono**, copyright 2017 IBM Corp., via `@fontsource/ibm-plex-mono`.

Both are distributed under the SIL Open Font License 1.1. Their copyright notices and licence text are included in [`public/third-party-font-licenses.txt`](public/third-party-font-licenses.txt), which Vite copies into the deployed site.

## Recorded-edition generation

The fixed narration is generated locally; none of the following model or runtime binaries is bundled into the browser application.

- **Kokoro 82M v1.0 ONNX**, `onnx-community/Kokoro-82M-v1.0-ONNX`, revision `1939ad2a8e416c0acfeecc08a694d14ef25f2231`, q8 model file SHA-256 `fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478`. The Hugging Face repository and its `hexgrad/Kokoro-82M` base model identify the weights as Apache-2.0. The base-model card also records training-data acknowledgements for Koniwa `tnc` (CC BY 3.0) and SIWIS (CC BY 4.0). Sources: [ONNX model card](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX), [base-model card](https://huggingface.co/hexgrad/Kokoro-82M), [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- **Emma voice data**, `bf_emma`, bundled by `kokoro-js@1.2.1`, SHA-256 `669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73`. The runtime catalogue labels it `en-gb` and `Female`; those labels are provenance metadata, not an independent certification of a person’s identity. The exact project-owner audition and its generation sidecar are retained under [`docs/narration/voice-selection/`](docs/narration/voice-selection/).
- **kokoro-js 1.2.1** and **Transformers.js 3.8.1** are Apache-2.0 generation dependencies. **ONNX Runtime 1.21.0** is MIT licensed. They live in the private, separately locked `tools/narration/` package rather than the root application dependency tree. That toolchain is excluded from Vercel uploads and is absent from the deployed Vite bundle.
- **phonemizer 1.2.1** declares Apache-2.0 in its npm package and embeds a WebAssembly build and language data from **eSpeak NG**. The eSpeak NG project states that eSpeak NG Text-to-Speech is GPL-3.0-or-later. Accordingly, anyone redistributing the generation runtime itself must review and satisfy the eSpeak NG terms rather than relying only on the npm package label. This repository does not copy the phonemiser, eSpeak WebAssembly or model weights into public assets; the deployed edition contains only the generated MP3 output. Sources: [phonemizer.js](https://github.com/xenova/phonemizer.js), [eSpeak NG](https://github.com/espeak-ng/espeak-ng), [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.html).

The generation configuration pins the model revision, required model-file checksums, runtime version, Emma voice checksum, speed and final encoding. `tools/narration/package-lock.json` additionally fixes the generation-only transitive dependency graph. The isolated toolchain currently inherits published `sharp`/libvips security advisories through Transformers.js; it is never needed by the application or deployed, and `npm audit --prefix tools/narration` must be reviewed before each future generation run. This notice records provenance and redistribution facts; it is not legal advice and does not expand the project’s own licence.
