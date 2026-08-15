# Book 3D material assets

The reader ships a native-4K production tier and retains its 2K fallback tier. All files are local so rendering never depends on a third-party request at runtime.

Every source asset is released under the [Creative Commons CC0 1.0 dedication](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is not required, but source and authorship are recorded for provenance. Poly Haven's licence is documented at <https://polyhaven.com/license>; ambientCG's licence is documented at <https://ambientcg.com/license>.

## Encoding policy

- **4K production tier:** exact bytes from the official JPEG or Radiance HDR distributions. There is no resize, colour conversion or second lossy encode. Retaining the source files is both smaller and higher fidelity than decoding their already-compressed JPEGs and recompressing them as WebP.
- **2K fallback tier:** original dimensions retained and converted from the official JPEG distributions with FFmpeg/libwebp. Base-colour and scalar utility maps use quality 92; normal maps use quality 94. The HDR fallback is the unchanged official distribution.
- **KTX2 assessment:** neither `toktx` nor `basisu` is installed in the repository toolchain, and KTX2 delivery also requires Three.js `KTX2Loader`, its Basis transcoder payload and runtime GPU-format detection. Adding those components would cross this asset-only change's dependency and application-code boundary. No pseudo-KTX2 files were produced. A later production pipeline should evaluate UASTC (with RDO) for normal maps and high-quality ETC1S or UASTC for colour/roughness against these exact-source masters.

Dimensions below were read from the decoded files with FFprobe. Sizes are exact bytes. SHA-256 values identify the exact local files.

## Cover cloth

Source asset: [Denim Fabric 05](https://polyhaven.com/a/denim_fabric_05), Poly Haven. Photography by colormass; processing by Rico Cilliers. This is a photographed dark-grey twill material.

| Local file | Dimensions | Bytes | PBR role | Exact official source URL | Local SHA-256 |
| --- | ---: | ---: | --- | --- | --- |
| `cover-cloth-color-4k.jpg` | 4096 × 4116 | 14,731,386 | sRGB base colour | <https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/denim_fabric_05/denim_fabric_05_diff_4k.jpg> | `63b5119e8144ee6b421d2f483e544e03428d4cccfce3dbb76b021a0d2ed0c79e` |
| `cover-cloth-normal-gl-4k.jpg` | 4096 × 4116 | 18,053,887 | Linear OpenGL normal | <https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/denim_fabric_05/denim_fabric_05_nor_gl_4k.jpg> | `0b4718075b48c293bf549edcbddaeddcd2322648d5ead55c10a0dfee0a8ded16` |
| `cover-cloth-arm-4k.jpg` | 4096 × 4116 | 19,761,378 | Linear packed AO (R), roughness (G), metalness (B) | <https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/denim_fabric_05/denim_fabric_05_arm_4k.jpg> | `9f0acc51fbe58d853cc877d46904c2163d36ef82f0361aa52158e0bec40f5a3c` |
| `cover-cloth-color-2k.webp` | 2048 × 2058 | 1,947,012 | sRGB base-colour fallback | <https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/denim_fabric_05/denim_fabric_05_diff_2k.jpg> | `c34b9c6384456f180c130ca770c674dcbd9670a14e3741336602269d06d46069` |
| `cover-cloth-normal-gl-2k.webp` | 2048 × 2058 | 2,523,982 | Linear OpenGL-normal fallback | <https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/denim_fabric_05/denim_fabric_05_nor_gl_2k.jpg> | `1b14185495c445cc7aadcc03afb7b8b86a2eb592c9726be4370726cc548af71f` |
| `cover-cloth-arm-2k.webp` | 2048 × 2058 | 2,092,848 | Linear packed ARM fallback | <https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/denim_fabric_05/denim_fabric_05_arm_2k.jpg> | `29d451828952aca16cfd4ec69bbc8ed19f56ace8a42cb57438ed094bb0ab6f14` |

For Three.js, the packed ARM file is assigned to both `aoMap` and `roughnessMap`; `MeshStandardMaterial` reads those values from the red and green channels respectively. All maps except base colour use `NoColorSpace`.

## Page paper

Source asset: [Paper 001](https://ambientcg.com/a/Paper001), ambientCG. ambientCG describes the material as height-field photogrammetry.

The exact 4K source archive URL is <https://ambientcg.com/get?file=Paper001_4K-JPG.zip> (44,059,058 bytes as published by the ambientCG API; downloaded archive SHA-256 `b4c5a3b50f53572c6bd2d1039b178da0f37ee48d916a4e189d76f894f7261c14`). The exact 2K source archive URL is <https://ambientcg.com/get?file=Paper001_2K-JPG.zip>. “Archive member” records which file was copied or converted.

| Local file | Dimensions | Bytes | PBR role | Archive member | Local SHA-256 |
| --- | ---: | ---: | --- | --- | --- |
| `page-paper-color-4k.jpg` | 4096 × 2402 | 3,684,106 | sRGB base colour | `Paper001_4K-JPG_Color.jpg` | `3aaed6c30f8bc7ea98628ccd75acb852e75d910f32f384f6193169214ab4bec1` |
| `page-paper-normal-gl-4k.jpg` | 4096 × 2402 | 13,758,787 | Linear OpenGL normal | `Paper001_4K-JPG_NormalGL.jpg` | `06c8dc9abafd531281fa24ab15d0d11e9b2a681f345565351056d68b6627c197` |
| `page-paper-roughness-4k.jpg` | 4096 × 2402 | 5,359,257 | Linear roughness | `Paper001_4K-JPG_Roughness.jpg` | `7f997e90909a4cf84625e9df971a6da93adb0aad33b9954632b5bd540b83d8b6` |
| `page-paper-color-2k.webp` | 2048 × 1201 | 318,756 | sRGB base-colour fallback | `Paper001_2K-JPG_Color.jpg` | `e240a35ee7002bbf3606fb93c90016572b913ed3e355346c83e52f38c5f00aa2` |
| `page-paper-normal-gl-2k.webp` | 2048 × 1201 | 1,294,122 | Linear OpenGL-normal fallback | `Paper001_2K-JPG_NormalGL.jpg` | `d152985b8376546f050a7b2521e84d97bdac9a7f72c28dfb8c4b0da299a0bf5b` |
| `page-paper-roughness-2k.webp` | 2048 × 1201 | 874,712 | Linear roughness fallback | `Paper001_2K-JPG_Roughness.jpg` | `be0142d41a57ce52ed3fd46e0d6047a96a47f1f3984f4717b6a04ce3d149bdf6` |

## Studio environment

Source asset: [Studio Small 04](https://polyhaven.com/a/studio_small_04), Poly Haven; captured and processed by Greg Zaal. It is an unclipped, high-contrast studio environment with a neutral cyclorama, dark curtains and two directional lamps.

| Local file | Dimensions | Bytes | Role | Exact official source URL | Local SHA-256 |
| --- | ---: | ---: | --- | --- | --- |
| `studio-small-04-4k.hdr` | 4096 × 2048 | 26,120,844 | Linear image-based lighting environment | <https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/studio_small_04_4k.hdr> | `165743e0fb515edefbc853196df760d60f7c6045e1c0132acf437d8968e6ba13` |
| `studio-small-04-2k.hdr` | 2048 × 1024 | 6,679,344 | Linear IBL fallback | <https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_04_2k.hdr> | `6ab4bf3246f068036b14d17983b657ba675aa05e254163f47c7e88a016db11fe` |

## Integrity and payload

Each JPEG/WebP decodes without error, the Radiance HDR files parse as 32-bit float RGB, and every decoded dimension matches the table above. The four-kilopixel tier is 101,469,645 bytes (96.77 MiB). The retained two-kilopixel tier is 15,730,776 bytes (15.00 MiB). Together the fourteen runtime assets total 117,200,421 bytes (111.77 MiB), before application code and audio.

The six runtime-selected native-4K surface maps decode to approximately 306 MiB of uncompressed RGBA texels before mipmaps; a conventional full mip chain brings that to approximately 407 MiB, before accounting for the HDR environment and render targets. Runtime code should therefore promote to the 4K tier only after capability and memory checks, release superseded 2K GPU textures after promotion, and preserve the 2K tier for constrained/mobile devices and WebGL context recovery.
