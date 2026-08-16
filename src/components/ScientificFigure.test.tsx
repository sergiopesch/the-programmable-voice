import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FigureKind } from '../types'
import { ScientificFigure } from './ScientificFigure'

interface FigureExpectation {
  kind: FigureKind
  title: string
  description: string
  visibleLabels: readonly string[]
  incompatibleLabel: string
}

const specialisedFigures: readonly FigureExpectation[] = [
  {
    kind: 'telephone-network',
    title: 'Subscriber → local loop → exchange → trunk → exchange → subscriber',
    description: 'Two subscribers connect through local loops to exchanges joined by a shared trunk; call setup selects a temporary end-to-end route.',
    visibleLabels: ['subscriber', 'local', 'loop', 'exchange', 'shared', 'trunk'],
    incompatibleLabel: 'frontier reasoning',
  },
  {
    kind: 'magnetic-tape',
    title: 'Erase → record → replay',
    description: 'A moving magnetic tape passes erase, record and replay heads in order, allowing an old pattern to be removed, a new one written and the result read back.',
    visibleLabels: ['ERASE', 'RECORD', 'REPLAY', 'old pattern removed', 'new pattern written', 'pattern read back'],
    incompatibleLabel: 'airborne pressure',
  },
  {
    kind: 'packet-voice',
    title: 'Capture → frame → encode → packetise → route → buffer → decode → play',
    description: 'A speech signal passes through capture, framing, encoding, packetisation, routing, a jitter buffer, decoding and playback; transit may vary and packets may be lost.',
    visibleLabels: ['capture', 'frame', 'encode', 'packetise', 'route', 'jitter', 'buffer', 'decode', 'play'],
    incompatibleLabel: 'barge-in',
  },
  {
    kind: 'training-corpus',
    title: 'Signal path — the corpus is part of the model',
    description: 'People and recording settings lead to recordings, consent and metadata, segmentation and labels, sampling and training, a metric and deployment; bias can enter at every transition.',
    visibleLabels: ['people +', 'settings', 'recordings', 'consent +', 'metadata', 'segments +', 'labels', 'sampling +', 'training', 'metric', 'deployment'],
    incompatibleLabel: 'TOOLS + MEMORY',
  },
  {
    kind: 'consent-provenance',
    title: 'Signal path — from permission to playback',
    description: 'Enrolment evidence and scoped consent lead through a protected voice model, authorised generation, signed provenance and channel disclosure to recipient verification.',
    visibleLabels: ['enrolment', 'evidence', 'scoped', 'consent', 'protected', 'voice model', 'authorised', 'generation', 'signed', 'provenance', 'channel', 'disclosure', 'recipient', 'verification'],
    incompatibleLabel: 'MICROPHONE ARRAY',
  },
]

describe('ScientificFigure semantic contracts', () => {
  for (const expectation of specialisedFigures) {
    it(`renders the ${expectation.kind} title, description and process`, () => {
      const markup = renderToStaticMarkup(
        <ScientificFigure kind={expectation.kind} title={expectation.title} />,
      )

      expect(markup).toContain(`aria-label="${expectation.title} diagram"`)
      expect(markup).toContain(`>${expectation.title}</title>`)
      expect(markup).toContain(`>${expectation.description}</desc>`)
      for (const label of expectation.visibleLabels) expect(markup).toContain(`>${label}<`)
      expect(markup).not.toContain(expectation.incompatibleLabel)
    })
  }
})
