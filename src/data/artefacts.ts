export type ArtefactKind = 'string' | 'telephone' | 'cylinder' | 'disc' | 'vinyl' | 'tape' | 'pcm' | 'cd' | 'file' | 'packet' | 'token'

export interface SoundArtefact {
  kind: ArtefactKind
  year: string
  title: string
  detail: string
  preserves: string
  discards: string
  citations: string[]
}

export function artefactTimelineDetail(artefact: SoundArtefact): string {
  return `${artefact.detail} Preserves: ${artefact.preserves}. Discards: ${artefact.discards}.`
}

export function artefactNarrationText(artefact: SoundArtefact): string {
  return `${artefact.year}. ${artefact.title}. ${artefactTimelineDetail(artefact)}`
}

export const soundArtefacts: SoundArtefact[] = [
  { kind: 'string', year: 'c. 2600 BCE', title: 'Lyre string', detail: 'Tension, length and mass organise vibration into repeatable modes, but the instrument stores no performance by itself.', preserves: 'A repeatable physical relation between gesture and pitch', discards: 'The sounded event when the vibration ends', citations: ['fdn-openstax-string', 'fdn-british-museum-instruments'] },
  { kind: 'telephone', year: '1876', title: 'Telephone', detail: 'A diaphragm turns changing air pressure into a varying electrical signal that can travel along a circuit.', preserves: 'Enough live speech contour for conversation at a distance', discards: 'The original room and much of the audible spectrum', citations: ['med-bell-patent', 'med-loc-telephone-priority'] },
  { kind: 'cylinder', year: '1877', title: 'Tinfoil cylinder', detail: 'A stylus indents a yielding foil wrapped around a rotating cylinder and later retraces that relief.', preserves: 'A pressure-shaped mechanical path through time', discards: 'Frequency extremes, dynamics and easy duplication', citations: ['fdn-edison-patent', 'fdn-loc-cylinder'] },
  { kind: 'disc', year: '1887', title: 'Flat disc', detail: 'A lateral spiral groove and disc master open a practical route to pressed copies; shellac compounds become important later.', preserves: 'A repeatable performance and manufacturable edition', discards: 'Frequency extremes, dynamics and physical durability', citations: ['med-berliner-patent', 'med-loc-gramophone'] },
  { kind: 'tape', year: '1935', title: 'Magnetic tape', detail: 'A changing field leaves a remanent pattern that can be copied, erased, cut and joined.', preserves: 'Continuous signal, editable time and generations of copies', discards: 'An untouched boundary between event and edit', citations: ['med-poulsen-patent', 'med-aes-magnetic-history'] },
  { kind: 'pcm', year: '1937', title: 'PCM', detail: 'Sampling measures the signal at regular instants; quantisation maps each measured amplitude to one of a finite set of numerical values.', preserves: 'A reproducible signal within a chosen sample rate and bit depth', discards: 'Content outside the chosen band; exact input amplitudes between the available quantisation levels are rounded', citations: ['med-reeves-pcm-patent', 'med-shannon-sampling'] },
  { kind: 'vinyl', year: '1948', title: 'Vinyl LP', detail: 'A fine microgroove and slower rotation lengthen the listening side and reduce noise relative to common shellac releases.', preserves: 'An album-scale sequence with improved consumer fidelity', discards: 'Perfect silence, immunity to wear and easy portability', citations: ['med-loc-lp', 'med-aes-stereo-history'] },
  { kind: 'packet', year: '1973', title: 'Voice packet', detail: 'Small timed pieces travel through a shared network and are reassembled at the listener.', preserves: 'Interactive voice across heterogeneous networks', discards: 'Certainty of arrival order, delay and sometimes missing sound', citations: ['med-nvp', 'med-rtp'] },
  { kind: 'cd', year: '1982', title: 'Compact disc', detail: 'Microscopic transitions, modulation and error correction encode digital audio for optical reading.', preserves: 'Stable consumer playback without stylus wear', discards: 'The continuous physical trace and easy home editing', citations: ['med-iec-cd', 'med-loc-cd-longevity'] },
  { kind: 'file', year: '1995', title: 'Compressed audio file', detail: 'Samples become portable data; perceptual codecs may remove what their models predict listeners are least likely to notice.', preserves: 'Copyable, searchable sound at a useful size', discards: 'Codec-dependent detail and, unless carried separately, historical context', citations: ['med-loc-mp3', 'med-fraunhofer-mp3'] },
  { kind: 'token', year: '2021', title: 'Audio token', detail: 'A learned codec maps recurring acoustic patterns to codebook indices that another model can process.', preserves: 'Features useful to the training and reconstruction objective', discards: 'Anything the learned representation was not trained to retain', citations: ['mac-soundstream2021', 'mac-encodec2022'] },
]
