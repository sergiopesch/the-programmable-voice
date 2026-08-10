import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NarrationPassage } from '../lib/narration'
import { narrationResponseInstructions, verifyNarrationTranscript } from '../lib/narrationTranscript'
import {
  connectRealtimeTransport,
  type RealtimeServerEvent,
  type RealtimeTransport,
} from '../lib/realtimeTransport'

export type NarrationStatus =
  | 'idle'
  | 'connecting'
  | 'verifying'
  | 'speaking'
  | 'paused'
  | 'error'
  | 'complete'

interface NarrationViewState {
  status: NarrationStatus
  currentIndex: number | null
  generatingIndex: number | null
  activeTargetId: string | null
  error: string | null
  announcement: string
}

interface Capture {
  runId: number
  passageIndex: number
  clientEventId: string
  recorder: MediaRecorder
  chunks: Blob[]
  responseId: string | null
  transcript: string
  responseDone: boolean
  bufferStopped: boolean
  recorderStopped: boolean
  verified: boolean
  cancelled: boolean
  watchdogId: number | null
}

interface PreparedAudio {
  passageIndex: number
  url: string
}

interface ActivePlayback extends PreparedAudio {
  runId: number
}

interface UseRealtimeNarrationOptions {
  passages: readonly NarrationPassage[]
  onPresentPassage: (passage: NarrationPassage) => Promise<void>
}

const INITIAL_STATE: NarrationViewState = {
  status: 'idle',
  currentIndex: null,
  generatingIndex: null,
  activeTargetId: null,
  error: null,
  announcement: '',
}

const MAX_SESSION_AGE_MS = 50 * 60 * 1000
const RESPONSE_IDLE_TIMEOUT_MS = 30_000

function responseObject(event: RealtimeServerEvent) {
  return event.response && typeof event.response === 'object'
    ? event.response as Record<string, unknown>
    : null
}

function responseMetadata(event: RealtimeServerEvent) {
  const response = responseObject(event)
  return response?.metadata && typeof response.metadata === 'object'
    ? response.metadata as Record<string, unknown>
    : null
}

function eventResponseId(event: RealtimeServerEvent) {
  if (typeof event.response_id === 'string') return event.response_id
  const response = responseObject(event)
  return typeof response?.id === 'string' ? response.id : null
}

function transcriptFromResponse(event: RealtimeServerEvent): string {
  const response = responseObject(event)
  if (!Array.isArray(response?.output)) return ''
  const transcripts: string[] = []
  for (const output of response.output) {
    if (!output || typeof output !== 'object') continue
    const content = (output as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const transcript = (part as Record<string, unknown>).transcript
      if (typeof transcript === 'string') transcripts.push(transcript)
    }
  }
  return transcripts.join(' ')
}

function recorderOptions(): MediaRecorderOptions | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm',
    'audio/mp4',
  ]
  const mimeType = typeof MediaRecorder.isTypeSupported === 'function'
    ? candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
    : undefined
  return mimeType ? { mimeType } : undefined
}

function passageNumberWithinSection(passages: readonly NarrationPassage[], index: number) {
  const sectionId = passages[index]?.sectionId
  if (!sectionId) return { current: 0, total: 0 }
  let current = 0
  let total = 0
  for (let passageIndex = 0; passageIndex < passages.length; passageIndex += 1) {
    if (passages[passageIndex]?.sectionId !== sectionId) continue
    total += 1
    if (passageIndex <= index) current += 1
  }
  return { current, total }
}

export function useRealtimeNarration({
  passages,
  onPresentPassage,
}: UseRealtimeNarrationOptions) {
  const [view, setView] = useState<NarrationViewState>(INITIAL_STATE)
  const passagesRef = useRef(passages)
  const presentPassageRef = useRef(onPresentPassage)
  const viewRef = useRef(view)
  const runIdRef = useRef(0)
  const transportRef = useRef<RealtimeTransport | null>(null)
  const connectAbortRef = useRef<AbortController | null>(null)
  const captureRef = useRef<Capture | null>(null)
  const preparedRef = useRef(new Map<number, PreparedAudio>())
  const playbackRef = useRef<ActivePlayback | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pausedRef = useRef(false)
  const resumeIndexRef = useRef<number | null>(null)
  const errorIndexRef = useRef<number | null>(null)
  const controlEventCounterRef = useRef(0)
  const ignoredControlEventIdsRef = useRef(new Set<string>())

  const generateRef = useRef<(passageIndex: number, runId: number) => Promise<void>>(async () => {})
  const playRef = useRef<(passageIndex: number, runId: number, resume?: boolean) => Promise<void>>(async () => {})
  const finaliseCaptureRef = useRef<(capture: Capture) => void>(() => {})
  const handleEventRef = useRef<(event: RealtimeServerEvent) => void>(() => {})
  const failRef = useRef<(message: string, retryIndex?: number) => void>(() => {})
  const clearRunResourcesRef = useRef<() => void>(() => {})
  const cancelCaptureRef = useRef<(sendCancel: boolean) => void>(() => {})
  const closeTransportRef = useRef<() => void>(() => {})

  passagesRef.current = passages
  presentPassageRef.current = onPresentPassage
  viewRef.current = view

  const revokePrepared = () => {
    for (const prepared of preparedRef.current.values()) URL.revokeObjectURL(prepared.url)
    preparedRef.current.clear()
  }

  const clearCaptureWatchdog = (capture: Capture) => {
    if (capture.watchdogId === null) return
    window.clearTimeout(capture.watchdogId)
    capture.watchdogId = null
  }

  const armCaptureWatchdog = (capture: Capture) => {
    clearCaptureWatchdog(capture)
    capture.watchdogId = window.setTimeout(() => {
      if (
        captureRef.current === capture &&
        !capture.cancelled &&
        capture.runId === runIdRef.current
      ) {
        failRef.current('The voice service stopped responding.', capture.passageIndex)
      }
    }, RESPONSE_IDLE_TIMEOUT_MS)
  }

  const cancelCapture = (sendCancel: boolean) => {
    const capture = captureRef.current
    if (!capture) return
    capture.cancelled = true
    clearCaptureWatchdog(capture)
    captureRef.current = null
    if (sendCancel) {
      const sendControl = (type: 'response.cancel' | 'output_audio_buffer.clear') => {
        const eventId = `book-control-${capture.runId}-${capture.passageIndex}-${++controlEventCounterRef.current}`
        const ignoredIds = ignoredControlEventIdsRef.current
        ignoredIds.add(eventId)
        while (ignoredIds.size > 32) {
          const oldest = ignoredIds.values().next().value
          if (typeof oldest !== 'string') break
          ignoredIds.delete(oldest)
        }
        try {
          transportRef.current?.send({ event_id: eventId, type })
        } catch {
          ignoredIds.delete(eventId)
        }
      }
      if (!capture.responseDone) sendControl('response.cancel')
      if (!capture.bufferStopped) sendControl('output_audio_buffer.clear')
    }
    if (capture.recorder.state !== 'inactive') {
      try { capture.recorder.stop() } catch { /* Recorder already stopped. */ }
    }
  }
  cancelCaptureRef.current = cancelCapture

  const clearPlayback = (revoke = true) => {
    const playback = playbackRef.current
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onplaying = null
      audio.onended = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
    }
    if (playback && revoke) URL.revokeObjectURL(playback.url)
    playbackRef.current = null
  }

  const closeTransport = () => {
    connectAbortRef.current?.abort()
    connectAbortRef.current = null
    transportRef.current?.close()
    transportRef.current = null
  }
  closeTransportRef.current = closeTransport

  const clearRunResources = () => {
    cancelCaptureRef.current(true)
    revokePrepared()
    clearPlayback()
    closeTransport()
  }
  clearRunResourcesRef.current = clearRunResources

  failRef.current = (message, retryIndex) => {
    const fallbackIndex = retryIndex ?? captureRef.current?.passageIndex ?? playbackRef.current?.passageIndex ?? viewRef.current.currentIndex ?? 0
    errorIndexRef.current = fallbackIndex
    runIdRef.current += 1
    pausedRef.current = false
    clearRunResourcesRef.current()
    setView({
      status: 'error',
      currentIndex: fallbackIndex,
      generatingIndex: null,
      activeTargetId: null,
      error: message,
      announcement: message,
    })
  }

  const ensureTransport = async (runId: number) => {
    const existing = transportRef.current
    if (existing && Date.now() - existing.connectedAt < MAX_SESSION_AGE_MS) return existing
    existing?.close()
    transportRef.current = null
    connectAbortRef.current?.abort()
    const controller = new AbortController()
    connectAbortRef.current = controller
    if (!playbackRef.current) {
      setView((current) => ({
        ...current,
        status: 'connecting',
        error: null,
        announcement: 'Connecting to the OpenAI Realtime book voice.',
      }))
    }
    const transport = await connectRealtimeTransport({
      signal: controller.signal,
      onEvent: (event) => handleEventRef.current(event),
      onFailure: (message) => failRef.current(message),
    })
    if (runIdRef.current !== runId || controller.signal.aborted) {
      transport.close()
      throw new DOMException('Stale Realtime session.', 'AbortError')
    }
    connectAbortRef.current = null
    transportRef.current = transport
    return transport
  }

  generateRef.current = async (passageIndex, runId) => {
    const passage = passagesRef.current[passageIndex]
    if (!passage || pausedRef.current || runIdRef.current !== runId) return
    if (captureRef.current || preparedRef.current.has(passageIndex)) return

    try {
      const transport = await ensureTransport(runId)
      if (pausedRef.current || runIdRef.current !== runId) return
      const recorder = new MediaRecorder(transport.remoteStream, recorderOptions())
      const capture: Capture = {
        runId,
        passageIndex,
        clientEventId: `book-response-${runId}-${passageIndex}`,
        recorder,
        chunks: [],
        responseId: null,
        transcript: '',
        responseDone: false,
        bufferStopped: false,
        recorderStopped: false,
        verified: false,
        cancelled: false,
        watchdogId: null,
      }
      captureRef.current = capture
      recorder.addEventListener('dataavailable', (event) => {
        if (!capture.cancelled && event.data.size > 0) capture.chunks.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        capture.recorderStopped = true
        finaliseCaptureRef.current(capture)
      })
      recorder.addEventListener('error', () => {
        if (!capture.cancelled) failRef.current('Transcript-checked audio recording failed.', passageIndex)
      })
      recorder.start()
      armCaptureWatchdog(capture)
      setView((current) => ({
        ...current,
        status: playbackRef.current ? current.status : 'verifying',
        currentIndex: current.currentIndex ?? passageIndex,
        generatingIndex: passageIndex,
        error: null,
        announcement: playbackRef.current
          ? current.announcement
          : 'Preparing the next passage and checking its transcript before playback.',
      }))
      transport.send({
        event_id: capture.clientEventId,
        type: 'response.create',
        response: {
          conversation: 'none',
          metadata: {
            book_passage_id: passage.id,
            book_run_id: String(runId),
          },
          output_modalities: ['audio'],
          input: [],
          instructions: narrationResponseInstructions(passage.text),
        },
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'The voice service is unavailable.'
      failRef.current(message, passageIndex)
    }
  }

  const configurePlayback = (playback: ActivePlayback, runId: number) => {
    const passage = passagesRef.current[playback.passageIndex]
    const audio = audioRef.current
    if (!passage || !audio) return
    playback.runId = runId
    audio.onplaying = () => {
      if (runIdRef.current !== runId || pausedRef.current || playbackRef.current !== playback) return
      resumeIndexRef.current = playback.passageIndex
      setView({
        status: 'speaking',
        currentIndex: playback.passageIndex,
        generatingIndex: captureRef.current?.passageIndex ?? null,
        activeTargetId: passage.targetId,
        error: null,
        announcement: `Reading ${passage.text.slice(0, 90)}${passage.text.length > 90 ? '…' : ''}`,
      })
      const nextIndex = playback.passageIndex + 1
      if (nextIndex < passagesRef.current.length && !captureRef.current && !preparedRef.current.has(nextIndex)) {
        void generateRef.current(nextIndex, runId)
      }
    }
    audio.onended = () => {
      if (runIdRef.current !== runId || pausedRef.current || playbackRef.current !== playback) return
      URL.revokeObjectURL(playback.url)
      playbackRef.current = null
      audio.removeAttribute('src')
      const nextIndex = playback.passageIndex + 1
      if (nextIndex >= passagesRef.current.length) {
        closeTransport()
        setView({
          status: 'complete',
          currentIndex: playback.passageIndex,
          generatingIndex: null,
          activeTargetId: null,
          error: null,
          announcement: 'The complete book narration is finished.',
        })
        return
      }
      setView((current) => ({
        ...current,
        status: 'verifying',
        currentIndex: nextIndex,
        activeTargetId: null,
        announcement: 'Preparing the next passage and checking its transcript before playback.',
      }))
      if (preparedRef.current.has(nextIndex)) void playRef.current(nextIndex, runId)
      else if (!captureRef.current) void generateRef.current(nextIndex, runId)
    }
    audio.onerror = () => {
      if (runIdRef.current === runId) failRef.current('Transcript-checked audio could not be played.', playback.passageIndex)
    }
  }

  playRef.current = async (passageIndex, runId, resume = false) => {
    if (pausedRef.current || runIdRef.current !== runId) return
    const passage = passagesRef.current[passageIndex]
    if (!passage) return
    let playback = playbackRef.current
    if (!resume) {
      const prepared = preparedRef.current.get(passageIndex)
      if (!prepared) return
      preparedRef.current.delete(passageIndex)
      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      audio.preload = 'auto'
      audio.setAttribute('playsinline', '')
      playback = { ...prepared, runId }
      playbackRef.current = playback
      audio.src = prepared.url
    }
    if (!playback || playback.passageIndex !== passageIndex) return

    try {
      await presentPassageRef.current(passage)
      if (pausedRef.current || runIdRef.current !== runId || playbackRef.current !== playback) return
      configurePlayback(playback, runId)
      await audioRef.current!.play()
    } catch (error) {
      if (runIdRef.current !== runId) return
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        pausedRef.current = true
        resumeIndexRef.current = passageIndex
        setView({
          status: 'paused',
          currentIndex: passageIndex,
          generatingIndex: null,
          activeTargetId: null,
          error: null,
          announcement: 'Playback is ready. Press Resume to hear the transcript-checked passage.',
        })
        return
      }
      failRef.current('Transcript-checked audio could not be played.', passageIndex)
    }
  }

  finaliseCaptureRef.current = (capture) => {
    if (
      capture.cancelled ||
      captureRef.current !== capture ||
      !capture.responseDone ||
      !capture.bufferStopped ||
      !capture.recorderStopped
    ) return

    captureRef.current = null
    clearCaptureWatchdog(capture)
    setView((current) => ({ ...current, generatingIndex: null }))
    if (!capture.verified) {
      failRef.current('Narration stopped because the generated transcript did not match the manuscript.', capture.passageIndex)
      return
    }
    const blob = new Blob(capture.chunks, { type: capture.recorder.mimeType || 'audio/webm' })
    if (blob.size === 0) {
      failRef.current('The voice service returned no playable audio.', capture.passageIndex)
      return
    }
    preparedRef.current.set(capture.passageIndex, {
      passageIndex: capture.passageIndex,
      url: URL.createObjectURL(blob),
    })
    if (!pausedRef.current && !playbackRef.current) {
      void playRef.current(capture.passageIndex, capture.runId)
    }
  }

  handleEventRef.current = (event) => {
    const capture = captureRef.current
    if (event.type === 'error') {
      const nestedError = event.error && typeof event.error === 'object'
        ? event.error as Record<string, unknown>
        : null
      const failedEventId = typeof nestedError?.event_id === 'string'
        ? nestedError.event_id
        : null
      if (failedEventId && ignoredControlEventIdsRef.current.delete(failedEventId)) return
      if (!capture || capture.cancelled || capture.runId !== runIdRef.current) return
      if (failedEventId && failedEventId !== capture.clientEventId) return
      failRef.current('The voice service rejected the narration request.', capture?.passageIndex)
      return
    }
    if (!capture || capture.cancelled || capture.runId !== runIdRef.current) return
    const passage = passagesRef.current[capture.passageIndex]
    if (!passage) return

    const metadata = responseMetadata(event)
    const metadataMatches = metadata?.book_passage_id === passage.id &&
      metadata.book_run_id === String(capture.runId)
    const responseId = eventResponseId(event)
    const responseMatches = capture.responseId ? responseId === capture.responseId : metadataMatches

    if (event.type === 'response.created' && metadataMatches && responseId) {
      capture.responseId = responseId
      armCaptureWatchdog(capture)
      return
    }
    if (!responseMatches) return
    armCaptureWatchdog(capture)

    if (event.type === 'response.output_audio_transcript.delta' && typeof event.delta === 'string') {
      capture.transcript += event.delta
      return
    }
    if (event.type === 'response.output_audio_transcript.done' && typeof event.transcript === 'string') {
      capture.transcript = event.transcript
      return
    }
    if (event.type === 'response.done') {
      const response = responseObject(event)
      if (response?.status !== 'completed') {
        failRef.current('The voice service did not complete the selected passage.', capture.passageIndex)
        return
      }
      capture.responseDone = true
      const transcript = capture.transcript || transcriptFromResponse(event)
      capture.verified = verifyNarrationTranscript(passage.text, transcript).matches
      if (!capture.verified) {
        cancelCapture(true)
        failRef.current('Narration stopped because the generated transcript did not match the manuscript.', capture.passageIndex)
        return
      }
      finaliseCaptureRef.current(capture)
      return
    }
    if (event.type === 'output_audio_buffer.stopped') {
      capture.bufferStopped = true
      if (capture.recorder.state !== 'inactive') capture.recorder.stop()
      else capture.recorderStopped = true
      finaliseCaptureRef.current(capture)
    }
  }

  const startAtIndex = useCallback((passageIndex: number) => {
    if (!passagesRef.current[passageIndex]) return
    window.dispatchEvent(new CustomEvent('pv:stop-media', { detail: { source: 'narration' } }))
    runIdRef.current += 1
    const runId = runIdRef.current
    clearRunResourcesRef.current()
    pausedRef.current = false
    resumeIndexRef.current = passageIndex
    errorIndexRef.current = null
    setView({
      status: 'connecting',
      currentIndex: passageIndex,
      generatingIndex: passageIndex,
      activeTargetId: null,
      error: null,
      announcement: 'Connecting to the OpenAI Realtime book voice.',
    })
    void generateRef.current(passageIndex, runId)
  }, [])

  const startFromSection = useCallback((sectionId: string) => {
    const passageIndex = passagesRef.current.findIndex((passage) => passage.sectionId === sectionId)
    if (passageIndex >= 0) startAtIndex(passageIndex)
  }, [startAtIndex])

  const pause = useCallback(() => {
    const playback = playbackRef.current
    const capture = captureRef.current
    const resumeIndex = playback?.passageIndex ?? capture?.passageIndex ?? viewRef.current.currentIndex
    if (resumeIndex === null || viewRef.current.status === 'idle') return
    runIdRef.current += 1
    pausedRef.current = true
    resumeIndexRef.current = resumeIndex
    audioRef.current?.pause()
    cancelCaptureRef.current(true)
    revokePrepared()
    closeTransportRef.current()
    setView((current) => ({
      ...current,
      status: 'paused',
      currentIndex: resumeIndex,
      generatingIndex: null,
      activeTargetId: null,
      error: null,
      announcement: 'Narration paused.',
    }))
  }, [])

  const resume = useCallback(() => {
    const passageIndex = resumeIndexRef.current
    if (passageIndex === null) return
    runIdRef.current += 1
    const runId = runIdRef.current
    pausedRef.current = false
    setView((current) => ({
      ...current,
      status: playbackRef.current ? 'verifying' : 'connecting',
      currentIndex: passageIndex,
      error: null,
      announcement: playbackRef.current
        ? 'Resuming the transcript-checked passage.'
        : 'Preparing the selected passage again.',
    }))
    if (playbackRef.current?.passageIndex === passageIndex) {
      void playRef.current(passageIndex, runId, true)
    } else {
      void generateRef.current(passageIndex, runId)
    }
  }, [])

  const stop = useCallback(() => {
    runIdRef.current += 1
    pausedRef.current = false
    resumeIndexRef.current = null
    errorIndexRef.current = null
    clearRunResourcesRef.current()
    setView(INITIAL_STATE)
  }, [])

  const retry = useCallback(() => {
    const passageIndex = errorIndexRef.current ?? viewRef.current.currentIndex
    if (passageIndex !== null) startAtIndex(passageIndex)
  }, [startAtIndex])

  useEffect(() => {
    const handleExternalStop = (event: Event) => {
      const source = event instanceof CustomEvent && event.detail && typeof event.detail === 'object'
        ? (event.detail as { source?: unknown }).source
        : null
      if (source !== 'narration') stop()
    }
    window.addEventListener('pv:stop-media', handleExternalStop)
    return () => window.removeEventListener('pv:stop-media', handleExternalStop)
  }, [stop])

  useEffect(() => () => {
    runIdRef.current += 1
    clearRunResourcesRef.current()
  }, [])

  const currentPassage = view.currentIndex === null ? null : passages[view.currentIndex] ?? null
  const sectionProgress = useMemo(
    () => view.currentIndex === null
      ? { current: 0, total: 0 }
      : passageNumberWithinSection(passages, view.currentIndex),
    [passages, view.currentIndex],
  )

  return {
    ...view,
    currentPassage,
    sectionProgress,
    startFromSection,
    pause,
    resume,
    stop,
    retry,
  }
}
