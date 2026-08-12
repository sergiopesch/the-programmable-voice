import { describe, expect, it } from 'vitest'
import { sections } from '../data/book'
import {
  narrationEditionConfiguration,
  narrationNormalisationVersionFor,
  narrationPassageHashMaterial,
  narrationPassageNormalisationOverrideFor,
  narrationPassageNormalisationOverrides,
  narrationPassageReadingNotes,
  narrationPassageSpokenReplacements,
  narrationPilotPassageIds,
  narrationReadingNoteFor,
  narrationSpokenTextFor,
} from '../data/narrationEdition'
import type { BookBlock, BookSection } from '../types'
import {
  bookNarrationPassages,
  bookNarrationUnits,
  extractNarrationUnits,
  extractSectionNarrationUnits,
  groupNarrationPassages,
  narrationTargetId,
} from './narration'

function manuscriptStringsForBlock(block: BookBlock): string[] {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return [block.text]
    case 'figure':
      return [block.title, block.caption]
    case 'callout':
      return [block.title, block.text]
    case 'list':
      return [...(block.title ? [block.title] : []), ...block.items]
    case 'timeline':
      return block.items.flatMap((item) => [item.year, item.title, item.detail])
    case 'glossary':
      return block.items.flatMap((item) => [item.term, item.definition])
  }
}

function manuscriptStringsForSection(section: BookSection): string[] {
  return [
    section.title,
    section.deck,
    ...section.blocks.flatMap(manuscriptStringsForBlock),
  ]
}

describe('book narration units', () => {
  it('preserves the complete manuscript order', () => {
    const encounteredSectionIds = bookNarrationUnits.reduce<string[]>((ids, unit) => {
      if (ids.at(-1) !== unit.sectionId) ids.push(unit.sectionId)
      return ids
    }, [])

    expect(encounteredSectionIds).toEqual(sections.map((section) => section.id))
    expect(encounteredSectionIds).toHaveLength(36)

    for (const section of sections) {
      expect(bookNarrationUnits.filter((unit) => unit.sectionId === section.id)).toEqual(
        extractSectionNarrationUnits(section),
      )
    }
  })

  it('assigns deterministic, unique stable ids and predictable visible target ids', () => {
    const repeatedExtraction = extractNarrationUnits(sections)
    expect(repeatedExtraction.map((unit) => unit.id)).toEqual(
      bookNarrationUnits.map((unit) => unit.id),
    )

    expect(new Set(bookNarrationUnits.map((unit) => unit.id)).size).toBe(
      bookNarrationUnits.length,
    )
    expect(narrationTargetId('machines-hear')).toBe('narration-machines-hear-header')
    expect(narrationTargetId('machines-hear', 2)).toBe('narration-machines-hear-block-2')
    expect(narrationTargetId('machines-hear', 2, 4)).toBe('narration-machines-hear-block-2-item-4')

    expect(bookNarrationUnits[0]).toEqual({
      id: 'narration:opening:section-title',
      sectionId: 'opening',
      targetId: 'narration-opening-header',
      kind: 'section-title',
      text: 'The Programmable Voice',
    })
    expect(bookNarrationUnits.at(-1)).toEqual({
      id: 'narration:trust-after-voice:block-9-list-item-8',
      sectionId: 'trust-after-voice',
      targetId: 'narration-trust-after-voice-block-9-item-8',
      kind: 'list-item',
      text: 'Owner and review — documentary team; 11 August 2027.',
    })

    for (const unit of bookNarrationUnits) {
      expect(unit.id).toMatch(/^narration:[a-z0-9-]+:[a-z0-9-]+$/)
      expect(unit.targetId).toMatch(/^narration-[a-z0-9-]+$/)
    }
  })

  it('never emits an empty narration response', () => {
    for (const unit of bookNarrationUnits) {
      expect(unit.text.trim(), unit.id).not.toBe('')
    }
  })

  it('covers every stored manuscript string exactly once and verbatim', () => {
    const manuscriptStrings = sections.flatMap(manuscriptStringsForSection)
    expect(bookNarrationUnits.map((unit) => unit.text)).toEqual(manuscriptStrings)
  })

  it('narrates the visible prologue and retains the authored lab demonstration', () => {
    const opening = sections[0]!
    expect(extractSectionNarrationUnits(opening).map((unit) => unit.text)).toEqual([
      opening.title,
      opening.deck,
      ...opening.blocks.flatMap(manuscriptStringsForBlock),
    ])

    const lab = sections.find((section) => section.kind === 'lab')!
    expect(extractSectionNarrationUnits(lab).map((unit) => unit.text)).toEqual([
      lab.title,
      lab.deck,
      ...lab.blocks.flatMap(manuscriptStringsForBlock),
    ])
  })

  it('groups adjacent strings only when they share one visible target', () => {
    expect(bookNarrationPassages.length).toBeLessThan(bookNarrationUnits.length)
    expect(bookNarrationPassages.flatMap((passage) => passage.unitIds)).toEqual(
      bookNarrationUnits.map((unit) => unit.id),
    )
    expect(new Set(bookNarrationPassages.map((passage) => passage.id)).size).toBe(
      bookNarrationPassages.length,
    )

    for (const passage of bookNarrationPassages) {
      const units = passage.unitIds.map((id) => bookNarrationUnits.find((unit) => unit.id === id)!)
      expect(new Set(units.map((unit) => unit.targetId))).toEqual(new Set([passage.targetId]))
      expect(new Set(units.map((unit) => unit.sectionId))).toEqual(new Set([passage.sectionId]))
      for (const unit of units) expect(passage.text).toContain(unit.text)
    }

    expect(groupNarrationPassages(bookNarrationUnits)).toEqual(bookNarrationPassages)
  })

  it('keeps pronunciation direction passage-scoped and covers the configured pilot', () => {
    const passageIds = new Set(bookNarrationPassages.map(({ id }) => id))
    for (const passageId of Object.keys(narrationPassageReadingNotes)) {
      expect(passageIds.has(passageId), passageId).toBe(true)
    }
    for (const passageId of Object.keys(narrationPassageSpokenReplacements)) {
      expect(passageIds.has(passageId), passageId).toBe(true)
    }

    expect(narrationReadingNoteFor('passage:fdn-string-tension:block-5-paragraph')).not.toContain('Mersenne')
    expect(narrationReadingNoteFor('passage:fdn-string-tension:block-6-paragraph')).toContain('Marin Mersenne')
    expect(narrationReadingNoteFor('passage:fdn-string-tension:block-7-paragraph')).toContain('Mersenne')
    expect(narrationReadingNoteFor('passage:chronology:block-0-timeline-item-2-year')).not.toContain('Mersenne')
    expect(narrationReadingNoteFor('passage:chronology:block-0-timeline-item-4-year')).toContain('Mersenne')
    expect(narrationReadingNoteFor('passage:chronology:block-0-timeline-item-8-year')).not.toContain('Poulsen')
    expect(narrationReadingNoteFor('passage:chronology:block-0-timeline-item-10-year')).toContain('Poulsen')

    const unnotedPassage = bookNarrationPassages.find(({ id }) => (
      !narrationPassageReadingNotes[id] && !narrationPassageSpokenReplacements[id]
    ))!
    expect(narrationPassageHashMaterial('configuration', unnotedPassage.id, 'Same text')).toBe('configuration\n\nSame text')
    expect(new Set(narrationPilotPassageIds).size).toBe(narrationPilotPassageIds.length)
    expect(narrationPilotPassageIds.every((id) => passageIds.has(id))).toBe(true)
    expect(narrationPilotPassageIds.filter((id) => narrationPassageSpokenReplacements[id])).toEqual([])
    expect(new Set(narrationPilotPassageIds.map((id) => bookNarrationPassages.find((passage) => passage.id === id)!.sectionId)).size).toBeGreaterThanOrEqual(5)
  })

  it('applies exact passage-scoped spoken normalisation and binds it into the passage digest', () => {
    const passageById = new Map(bookNarrationPassages.map((passage) => [passage.id, passage]))

    for (const [passageId, replacements] of Object.entries(narrationPassageSpokenReplacements)) {
      const passage = passageById.get(passageId)!
      const visibleText = passage.text
      const spokenText = narrationSpokenTextFor(passageId, visibleText)
      expect(spokenText, passageId).not.toBe(visibleText)
      expect(passage.text, passageId).toBe(visibleText)
      expect(narrationPassageHashMaterial('configuration', passageId, visibleText)).toBe([
        'configuration',
        narrationReadingNoteFor(passageId),
        visibleText,
        'spoken-normalisation-v1',
        JSON.stringify(replacements),
        spokenText,
      ].join('\n'))
    }

    const examples = [
      ['passage:fdn-disturbance-world:block-4-list-item-1', 'vee equals eff lambda'],
      ['passage:media-disc-shellac:block-3-figure-title', 'to'],
      ['passage:templates-to-probabilities:block-5-timeline-item-3-year', 'H-M-M'],
      ['passage:whose-voice-in-data:block-9-paragraph', 'S-P eight hundred dash sixty-three B dash four'],
      ['passage:voice-becomes-tokens:block-6-paragraph', 'Valley'],
      ['passage:consent-provenance-synthetic-self:block-6-paragraph', 'C-two-P-A'],
      ['passage:access-restoration-agency:block-10-paragraph', 'Article four, paragraph three'],
      ['passage:chronology:block-0-timeline-item-0-year', 'more than thirty-five thousand years ago'],
    ] as const
    for (const [passageId, expectedSpeech] of examples) {
      const passage = passageById.get(passageId)!
      expect(narrationSpokenTextFor(passageId, passage.text)).toContain(expectedSpeech)
    }
  })

  it('binds codec-compensated mastering exceptions only to their passages and leaves pilot identity unchanged', () => {
    const passageId = 'passage:access-restoration-agency:block-2-heading'
    const epiloguePassageId = 'passage:air-again:block-5-heading'
    const passage = bookNarrationPassages.find((candidate) => candidate.id === passageId)!
    const override = narrationPassageNormalisationOverrideFor(passageId)!

    expect(Object.keys(narrationPassageNormalisationOverrides)).toEqual([passageId, epiloguePassageId])
    expect(override).toEqual({
      method: 'codec-compensated-single-pass-loudnorm',
      preEncodeTruePeakDbtp: -1.25,
      freshRawDiagnostic: {
        inputIntegratedLoudnessLufs: -19.8,
        inputTruePeakDbtp: -0.89,
        globalTargetMp3IntegratedLoudnessLufs: -21.36,
        globalTargetMp3TruePeakDbtp: -2.9,
        compensatedMp3IntegratedLoudnessLufs: -20.57,
        compensatedMp3TruePeakDbtp: -2.26,
      },
      version: 'loudnorm-codec-compensated-single-pass-2026.2-24khz-48kbps',
    })
    expect(narrationNormalisationVersionFor(passageId)).toBe(override.version)
    expect(override.version).not.toBe(narrationEditionConfiguration.normalisation.version)
    expect(narrationPassageHashMaterial('configuration', passageId, passage.text)).toBe([
      'configuration',
      narrationReadingNoteFor(passageId),
      passage.text,
      'passage-normalisation-v1',
      JSON.stringify(override),
    ].join('\n'))

    const epiloguePassage = bookNarrationPassages.find((candidate) => candidate.id === epiloguePassageId)!
    const epilogueOverride = narrationPassageNormalisationOverrideFor(epiloguePassageId)!
    expect(epilogueOverride).toEqual({
      method: 'post-normalisation-gain-limiter',
      postNormalisationGainDb: 2,
      limiter: {
        limitLinear: 0.8413951416451951,
        attackMilliseconds: 5,
        releaseMilliseconds: 50,
        autoReleaseControl: false,
        autoLevel: false,
        latencyCompensation: false,
      },
      freshRawDiagnostic: {
        inputIntegratedLoudnessLufs: -19.44,
        inputTruePeakDbtp: 0.04,
        globalTargetMp3IntegratedLoudnessLufs: -21.87,
        globalTargetMp3TruePeakDbtp: -2.76,
        compensatedMp3IntegratedLoudnessLufs: -19.91,
        compensatedMp3TruePeakDbtp: -1.97,
      },
      qualityDiagnostic: {
        maximumGainReductionDb: 1.5,
        integratedLoudnessCostLu: 0.04,
      },
      version: 'loudnorm-post-gain-limiter-2026.2-24khz-48kbps',
    })
    expect(narrationNormalisationVersionFor(epiloguePassageId)).toBe(epilogueOverride.version)
    expect(epilogueOverride.version).not.toBe(narrationEditionConfiguration.normalisation.version)
    expect(narrationPassageHashMaterial('configuration', epiloguePassageId, epiloguePassage.text)).toBe([
      'configuration',
      narrationReadingNoteFor(epiloguePassageId),
      epiloguePassage.text,
      'passage-normalisation-v1',
      JSON.stringify(epilogueOverride),
    ].join('\n'))

    for (const pilotId of narrationPilotPassageIds) {
      const pilotPassage = bookNarrationPassages.find((candidate) => candidate.id === pilotId)!
      expect(narrationPassageNormalisationOverrideFor(pilotId), pilotId).toBeNull()
      expect(narrationNormalisationVersionFor(pilotId), pilotId).toBe(narrationEditionConfiguration.normalisation.version)
      expect(narrationPassageHashMaterial('configuration', pilotId, pilotPassage.text), pilotId).toBe([
        'configuration',
        narrationReadingNoteFor(pilotId),
        pilotPassage.text,
      ].join('\n'))
    }
  })

  it('fails closed when exact spoken-normalisation source text drifts or becomes ambiguous', () => {
    const passageId = 'passage:fdn-disturbance-world:block-4-list-item-1'
    const passage = bookNarrationPassages.find(({ id }) => id === passageId)!
    expect(() => narrationSpokenTextFor(passageId, passage.text.replace('v = fλ', 'v equals f lambda'))).toThrow(
      /expected 1 occurrence\(s\).*found 0/,
    )
    expect(() => narrationSpokenTextFor(passageId, `${passage.text} v = fλ`)).toThrow(
      /expected 1 occurrence\(s\).*found 2/,
    )
  })
})
