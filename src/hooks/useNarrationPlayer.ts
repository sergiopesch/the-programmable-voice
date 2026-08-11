import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  narrationDisclosure,
  narrationEditionAssetDirectory,
  narrationEditionConfiguration,
  narrationGenerationProvenance,
  narrationPassageHashMaterial,
} from '../data/narrationEdition'
import type { NarrationPassage } from '../lib/narration'
import {
  narrationReleaseApprovalIsComplete,
  narrationReleaseId,
  narrationReleaseIdentityMaterial,
  narrationReleaseManifestUrl,
  type NarrationManifest,
  type NarrationManifestEntry,
} from '../lib/narrationRelease'

export type { NarrationManifestEntry } from '../lib/narrationRelease'

export type NarrationStatus = 'idle' | 'loading' | 'speaking' | 'paused' | 'error' | 'complete'
export type NarrationCatalogueStatus = 'loading' | 'ready' | 'error'

interface NarrationViewState {
  status: NarrationStatus
  currentIndex: number | null
  activeTargetId: string | null
  error: string | null
  announcement: string
  currentTime: number
  duration: number
}

interface UseNarrationPlayerOptions {
  passages: readonly NarrationPassage[]
  onPresentPassage: (passage: NarrationPassage) => Promise<void>
}

const MANIFEST_URL = '/audio/narration/manifest.json'
const POSITION_KEY = 'pv:narration-position:v3'
const INITIAL_STATE: NarrationViewState = {
  status: 'idle',
  currentIndex: null,
  activeTargetId: null,
  error: null,
  announcement: '',
  currentTime: 0,
  duration: 0,
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

interface SavedPosition {
  version: 3
  edition: string
  passageId: string
  currentTime: number
}

function readPosition(passages: readonly NarrationPassage[]): SavedPosition | null {
  try {
    const stored = JSON.parse(localStorage.getItem(POSITION_KEY) ?? '{}') as Partial<SavedPosition>
    if (
      stored.version !== 3
      || stored.edition !== narrationEditionConfiguration.edition
      || typeof stored.passageId !== 'string'
      || typeof stored.currentTime !== 'number'
      || !Number.isFinite(stored.currentTime)
      || stored.currentTime < 0
      || !passages.some(({ id }) => id === stored.passageId)
    ) return null
    return stored as SavedPosition
  } catch {
    return null
  }
}

function savePosition(passageId: string, currentTime: number) {
  try {
    const position: SavedPosition = {
      version: 3,
      edition: narrationEditionConfiguration.edition,
      passageId,
      currentTime: Math.max(0, currentTime),
    }
    localStorage.setItem(POSITION_KEY, JSON.stringify(position))
  } catch {
    // Playback remains available when storage is blocked.
  }
}

function clearPosition() {
  try {
    localStorage.removeItem(POSITION_KEY)
  } catch {
    // Completion remains available when storage is blocked.
  }
}

async function sha256Hex(value: string) {
  if (!crypto.subtle) throw new Error('This browser cannot verify the recorded edition.')
  const bytes = new TextEncoder().encode(value)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function loadManifest(passages: readonly NarrationPassage[], signal?: AbortSignal): Promise<NarrationManifest> {
  const response = await fetch(MANIFEST_URL, { signal, cache: 'no-cache' })
  if (!response.ok || !response.headers.get('content-type')?.toLocaleLowerCase().includes('json')) {
    throw new Error('The approved recorded edition is not available yet.')
  }
  let manifest: NarrationManifest
  try {
    manifest = await response.json() as NarrationManifest
  } catch {
    throw new Error('The approved recorded edition is not available yet.')
  }

  if (
    !manifest
    || manifest.schemaVersion !== 1
    || typeof manifest.edition !== 'string'
    || typeof manifest.releaseId !== 'string'
    || typeof manifest.releaseManifestUrl !== 'string'
    || !manifest.generationScope
    || !Array.isArray(manifest.passages)
    || manifest.passages.some((entry) => !entry || !entry.technicalQc)
  ) {
    throw new Error('The recorded edition does not match this manuscript and cannot be played.')
  }

  const configurationHash = await sha256Hex(JSON.stringify(narrationEditionConfiguration))
  const expected = await Promise.all(passages.map(async (passage) => ({
    passage,
    textHash: await sha256Hex(narrationPassageHashMaterial(configurationHash, passage.id, passage.text)),
  })))
  const manuscriptHash = await sha256Hex(JSON.stringify(expected.map(({ passage, textHash }) => ({ id: passage.id, textHash }))))
  const { releaseId, releaseManifestUrl, approved, approval, ...identityFields } = manifest
  const expectedReleaseId = narrationReleaseId(manifest.edition, await sha256Hex(narrationReleaseIdentityMaterial(identityFields)))
  if (
    manifest.schemaVersion !== 1
    || !manifest.complete
    || !approved
    || !narrationReleaseApprovalIsComplete(approval)
    || manifest.disclosure !== narrationDisclosure
    || manifest.configurationHash !== configurationHash
    || manifest.manuscriptHash !== manuscriptHash
    || manifest.edition !== narrationEditionConfiguration.edition
    || manifest.model !== narrationEditionConfiguration.model
    || manifest.voice !== narrationEditionConfiguration.voice
    || JSON.stringify(manifest.provenance) !== JSON.stringify(narrationGenerationProvenance)
    || manifest.generationScope.mode !== 'full'
    || manifest.generationScope.requestedPassageCount !== expected.length
    || manifest.passageCount !== expected.length
    || manifest.passages.length !== expected.length
    || releaseId !== expectedReleaseId
    || releaseManifestUrl !== narrationReleaseManifestUrl(expectedReleaseId)
  ) {
    throw new Error('The recorded edition does not match this manuscript and cannot be played.')
  }
  for (let index = 0; index < expected.length; index += 1) {
    const { passage, textHash } = expected[index]!
    const entry = manifest.passages[index]
    if (
      !entry
      || entry.id !== passage.id
      || entry.sectionId !== passage.sectionId
      || entry.targetId !== passage.targetId
      || entry.textHash !== textHash
      || entry.qcStatus !== 'technical-qc-passed'
      || !entry.url.startsWith(`/audio/narration/${narrationEditionAssetDirectory}/`)
      || !entry.url.includes(entry.sha256)
      || entry.technicalQc?.normalisationVersion !== narrationEditionConfiguration.normalisation.version
      || entry.technicalQc?.fullDecodePassed !== true
    ) {
      throw new Error(`The approved recording for ${passage.id} failed integrity checks.`)
    }
  }
  return manifest
}

export function useNarrationPlayer({ passages, onPresentPassage }: UseNarrationPlayerOptions) {
  const [view, setView] = useState<NarrationViewState>(INITIAL_STATE)
  const [catalogueStatus, setCatalogueStatus] = useState<NarrationCatalogueStatus>('loading')
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const [playbackRate, setPlaybackRateState] = useState(1)
  const manifestRef = useRef<NarrationManifest | null>(null)
  const manifestPromiseRef = useRef<Promise<NarrationManifest> | null>(null)
  const entryByIdRef = useRef(new Map<string, NarrationManifestEntry>())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCleanupRef = useRef<(() => void) | null>(null)
  const preparedIndexRef = useRef<number | null>(null)
  const indexRef = useRef<number | null>(null)
  const desiredPausedRef = useRef(false)
  const runIdRef = useRef(0)
  const lastPositionWriteRef = useRef(0)
  const onPresentPassageRef = useRef(onPresentPassage)
  const passagesRef = useRef(passages)
  const playIndexRef = useRef<(index: number, runId: number, resume?: boolean) => Promise<void>>(async () => {})

  useEffect(() => { onPresentPassageRef.current = onPresentPassage }, [onPresentPassage])
  useEffect(() => { passagesRef.current = passages }, [passages])

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'auto'
    }
    return audioRef.current
  }, [])

  const ensureManifest = useCallback(() => {
    if (manifestRef.current) return Promise.resolve(manifestRef.current)
    if (!manifestPromiseRef.current) {
      manifestPromiseRef.current = loadManifest(passagesRef.current).then((manifest) => {
        manifestRef.current = manifest
        entryByIdRef.current = new Map(manifest.passages.map((entry) => [entry.id, entry]))
        setCatalogueStatus('ready')
        setCatalogueError(null)
        return manifest
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'The approved recorded edition is unavailable.'
        setCatalogueStatus('error')
        setCatalogueError(message)
        throw error
      }).finally(() => {
        manifestPromiseRef.current = null
      })
    }
    return manifestPromiseRef.current
  }, [])

  const releaseAudioEvents = useCallback(() => {
    audioCleanupRef.current?.()
    audioCleanupRef.current = null
  }, [])

  const stopAudio = useCallback(() => {
    releaseAudioEvents()
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    preparedIndexRef.current = null
  }, [releaseAudioEvents])

  const fail = useCallback((message: string, index: number | null) => {
    stopAudio()
    indexRef.current = index
    setView({ ...INITIAL_STATE, status: 'error', currentIndex: index, error: message, announcement: message })
  }, [stopAudio])

  const playIndex = useCallback(async (index: number, runId: number, resume = false) => {
    const passage = passagesRef.current[index]
    if (!passage || runId !== runIdRef.current) return
    indexRef.current = index
    setView((current) => ({
      ...current,
      status: desiredPausedRef.current ? 'paused' : 'loading',
      currentIndex: index,
      activeTargetId: passage.targetId,
      error: null,
      currentTime: 0,
      duration: 0,
      announcement: `Preparing recorded narration for ${passage.sectionId}.`,
    }))

    try {
      await ensureManifest()
      if (runId !== runIdRef.current) return
      const entry = entryByIdRef.current.get(passage.id)
      if (!entry) return fail(`This edition has no approved recording for ${passage.id}.`, index)
      await onPresentPassageRef.current(passage)
      if (runId !== runIdRef.current) return

      releaseAudioEvents()
      const audio = getAudio()
      audio.pause()
      audio.src = entry.url
      audio.preload = 'auto'
      audio.playbackRate = playbackRate
      preparedIndexRef.current = index

      const savedPosition = resume ? readPosition(passagesRef.current) : null
      let resumeTime = savedPosition?.passageId === passage.id ? savedPosition.currentTime : null
      const applyResumeTime = () => {
        if (resumeTime === null) return
        const maximum = Math.max(0, (Number.isFinite(audio.duration) ? audio.duration : entry.durationSeconds) - 0.25)
        const restoredTime = Math.min(maximum, resumeTime)
        try {
          audio.currentTime = restoredTime
          setView((current) => ({ ...current, currentTime: restoredTime }))
          resumeTime = null
        } catch {
          // Some engines only permit seeking after metadata has loaded.
        }
      }
      const onTimeUpdate = () => {
        if (indexRef.current !== index) return
        const now = Date.now()
        if (now - lastPositionWriteRef.current >= 1_000) {
          savePosition(passage.id, audio.currentTime)
          lastPositionWriteRef.current = now
        }
        setView((current) => ({ ...current, currentTime: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : current.duration }))
      }
      const onDuration = () => {
        applyResumeTime()
        setView((current) => ({ ...current, duration: Number.isFinite(audio.duration) ? audio.duration : entry.durationSeconds }))
      }
      const onError = () => { if (runId === runIdRef.current) fail('The approved narration file could not be played.', index) }
      const onEnded = () => {
        if (runId !== runIdRef.current) return
        const nextIndex = index + 1
        if (!passagesRef.current[nextIndex]) {
          clearPosition()
          setView((current) => ({ ...current, status: 'complete', activeTargetId: null, announcement: 'The recorded edition is complete.' }))
          return
        }
        savePosition(passagesRef.current[nextIndex]!.id, 0)
        void playIndexRef.current(nextIndex, runId)
      }
      audio.addEventListener('timeupdate', onTimeUpdate)
      audio.addEventListener('loadedmetadata', onDuration)
      audio.addEventListener('durationchange', onDuration)
      audio.addEventListener('error', onError, { once: true })
      audio.addEventListener('ended', onEnded, { once: true })
      audioCleanupRef.current = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.removeEventListener('loadedmetadata', onDuration)
        audio.removeEventListener('durationchange', onDuration)
        audio.removeEventListener('error', onError)
        audio.removeEventListener('ended', onEnded)
      }

      if (resumeTime !== null) applyResumeTime()
      if (desiredPausedRef.current) {
        setView((current) => ({ ...current, status: 'paused', duration: entry.durationSeconds, announcement: 'Narration paused.' }))
        return
      }

      await audio.play()
      if (runId !== runIdRef.current) return
      setView((current) => ({
        ...current,
        status: 'speaking',
        currentIndex: index,
        activeTargetId: passage.targetId,
        error: null,
        duration: Number.isFinite(audio.duration) ? audio.duration : entry.durationSeconds,
        announcement: `Playing the approved recording for ${passage.sectionId}.`,
      }))

      const nextPassage = passagesRef.current[index + 1]
      const nextEntry = nextPassage ? entryByIdRef.current.get(nextPassage.id) : null
      if (nextEntry) {
        const preload = document.createElement('link')
        preload.rel = 'prefetch'
        preload.as = 'audio'
        preload.href = nextEntry.url
        document.head.append(preload)
        window.setTimeout(() => preload.remove(), 30_000)
      }
    } catch (error) {
      if (runId !== runIdRef.current) return
      const message = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Your browser paused the recording. Press Retry to continue.'
        : error instanceof Error ? error.message : 'Recorded narration could not start.'
      fail(message, index)
    }
  }, [ensureManifest, fail, getAudio, playbackRate, releaseAudioEvents])

  useEffect(() => { playIndexRef.current = playIndex }, [playIndex])
  useEffect(() => { void ensureManifest().catch(() => undefined) }, [ensureManifest])

  const startAtIndex = useCallback((index: number, resume = false) => {
    if (!passagesRef.current[index] || catalogueStatus !== 'ready') return
    window.dispatchEvent(new CustomEvent('pv:stop-media', { detail: { source: 'narration' } }))
    desiredPausedRef.current = false
    runIdRef.current += 1
    void playIndexRef.current(index, runIdRef.current, resume)
  }, [catalogueStatus])

  const startFromSection = useCallback((sectionId: string) => {
    const firstIndex = passagesRef.current.findIndex((passage) => passage.sectionId === sectionId)
    if (firstIndex < 0) return
    const stored = readPosition(passagesRef.current)
    const storedIndex = stored
      ? passagesRef.current.findIndex((passage) => passage.id === stored.passageId && passage.sectionId === sectionId)
      : -1
    startAtIndex(storedIndex >= 0 ? storedIndex : firstIndex, storedIndex >= 0)
  }, [startAtIndex])

  const pause = useCallback(() => {
    if (indexRef.current === null) return
    desiredPausedRef.current = true
    const audio = audioRef.current
    audio?.pause()
    const passage = passagesRef.current[indexRef.current]
    if (audio && passage) savePosition(passage.id, audio.currentTime)
    setView((current) => ({ ...current, status: 'paused', activeTargetId: passage?.targetId ?? current.activeTargetId, announcement: 'Narration paused.' }))
  }, [])

  const resume = useCallback(() => {
    if (indexRef.current === null) return
    desiredPausedRef.current = false
    const index = indexRef.current
    const runId = runIdRef.current
    const audio = audioRef.current
    if (audio && preparedIndexRef.current === index && audio.src) {
      void audio.play().then(() => {
        if (runId !== runIdRef.current || desiredPausedRef.current) return
        const passage = passagesRef.current[index]
        setView((current) => ({ ...current, status: 'speaking', activeTargetId: passage?.targetId ?? current.activeTargetId, announcement: 'Narration resumed.' }))
      }).catch(() => fail('Narration could not resume.', index))
      return
    }
    void playIndexRef.current(index, runId, true)
  }, [fail])

  const stop = useCallback(() => {
    runIdRef.current += 1
    desiredPausedRef.current = false
    stopAudio()
    indexRef.current = null
    setView(INITIAL_STATE)
  }, [stopAudio])

  const retry = useCallback(() => { if (indexRef.current !== null) startAtIndex(indexRef.current, true) }, [startAtIndex])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio || preparedIndexRef.current === null || !Number.isFinite(audio.duration)) return
    audio.currentTime = Math.min(audio.duration, Math.max(0, time))
    setView((current) => ({ ...current, currentTime: audio.currentTime, duration: audio.duration }))
  }, [])

  const setPlaybackRate = useCallback((rate: number) => {
    const clamped = Math.min(2, Math.max(0.75, rate))
    setPlaybackRateState(clamped)
    if (audioRef.current) audioRef.current.playbackRate = clamped
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', resume)
    navigator.mediaSession.setActionHandler('pause', pause)
    navigator.mediaSession.setActionHandler('stop', stop)
    navigator.mediaSession.setActionHandler('seekbackward', (details) => seek((audioRef.current?.currentTime ?? 0) - (details.seekOffset ?? 15)))
    navigator.mediaSession.setActionHandler('seekforward', (details) => seek((audioRef.current?.currentTime ?? 0) + (details.seekOffset ?? 15)))
    return () => {
      for (const action of ['play', 'pause', 'stop', 'seekbackward', 'seekforward'] as MediaSessionAction[]) navigator.mediaSession.setActionHandler(action, null)
    }
  }, [pause, resume, seek, stop])

  useEffect(() => {
    const handleExternalStop = (event: Event) => {
      const source = event instanceof CustomEvent && event.detail && typeof event.detail === 'object' ? (event.detail as { source?: unknown }).source : null
      if (source !== 'narration') stop()
    }
    window.addEventListener('pv:stop-media', handleExternalStop)
    return () => window.removeEventListener('pv:stop-media', handleExternalStop)
  }, [stop])

  useEffect(() => () => {
    runIdRef.current += 1
    stopAudio()
  }, [stopAudio])

  const currentPassage = view.currentIndex === null ? null : passages[view.currentIndex] ?? null
  const sectionProgress = useMemo(() => view.currentIndex === null ? { current: 0, total: 0 } : passageNumberWithinSection(passages, view.currentIndex), [passages, view.currentIndex])

  return {
    ...view,
    catalogueStatus,
    catalogueError,
    currentPassage,
    sectionProgress,
    playbackRate,
    startFromSection,
    pause,
    resume,
    stop,
    retry,
    seek,
    setPlaybackRate,
  }
}
