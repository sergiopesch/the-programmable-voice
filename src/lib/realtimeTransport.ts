const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'
const CONNECTION_TIMEOUT_MS = 20_000

export interface RealtimeServerEvent {
  type: string
  [key: string]: unknown
}

export interface RealtimeTransport {
  readonly connectedAt: number
  readonly remoteStream: MediaStream
  send(event: Record<string, unknown>): void
  close(): void
}

interface ConnectRealtimeTransportOptions {
  signal: AbortSignal
  onEvent: (event: RealtimeServerEvent) => void
  onFailure: (message: string) => void
}

interface ClientSecretPayload {
  value: string
  expires_at: number
}

function isClientSecretPayload(value: unknown): value is ClientSecretPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.value === 'string' && candidate.value.length > 0 &&
    typeof candidate.expires_at === 'number'
}

function abortError() {
  return new DOMException('The Realtime connection was cancelled.', 'AbortError')
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => finish(() => reject(abortError()))
    const finish = (complete: () => void) => {
      signal.removeEventListener('abort', onAbort)
      complete()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    )
  })
}

function waitForDataChannelOpen(channel: RTCDataChannel, signal: AbortSignal) {
  if (channel.readyState === 'open') return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(() => reject(new Error('Voice connection timed out.'))), 15_000)
    const onOpen = () => finish(resolve)
    const onError = () => finish(() => reject(new Error('Voice connection could not open.')))
    const onAbort = () => finish(() => reject(abortError()))
    const finish = (complete: () => void) => {
      window.clearTimeout(timeout)
      channel.removeEventListener('open', onOpen)
      channel.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
      complete()
    }
    channel.addEventListener('open', onOpen)
    channel.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function remoteStreamPromise(peer: RTCPeerConnection, signal: AbortSignal) {
  return new Promise<MediaStream>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(() => reject(new Error('The voice audio track did not arrive.'))), 15_000)
    const onTrack = (event: RTCTrackEvent) => {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      finish(() => resolve(stream))
    }
    const onAbort = () => finish(() => reject(abortError()))
    const finish = (complete: () => void) => {
      window.clearTimeout(timeout)
      peer.removeEventListener('track', onTrack)
      signal.removeEventListener('abort', onAbort)
      complete()
    }
    peer.addEventListener('track', onTrack)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function readSafeError(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { error?: unknown }
    return typeof payload.error === 'string' ? payload.error : fallback
  } catch {
    return fallback
  }
}

export async function connectRealtimeTransport({
  signal,
  onEvent,
  onFailure,
}: ConnectRealtimeTransportOptions): Promise<RealtimeTransport> {
  if (typeof RTCPeerConnection === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Transcript-checked Realtime narration is unavailable in this browser.')
  }

  let peer: RTCPeerConnection | null = null
  let channel: RTCDataChannel | null = null
  let remoteStream: MediaStream | null = null
  let silentSink: HTMLAudioElement | null = null
  let intentionalClose = false
  let timedOut = false
  const lifecycle = new AbortController()
  let abortLifecycle: () => void = () => {}
  let deadlineId: number | null = null

  const cleanup = () => {
    if (intentionalClose) return
    intentionalClose = true
    if (deadlineId !== null) {
      window.clearTimeout(deadlineId)
      deadlineId = null
    }
    lifecycle.abort()
    signal.removeEventListener('abort', abortLifecycle)
    try { channel?.close() } catch { /* Already closed. */ }
    peer?.close()
    silentSink?.pause()
    if (silentSink) {
      silentSink.srcObject = null
      silentSink.remove()
    }
    for (const track of remoteStream?.getTracks() ?? []) track.stop()
  }
  abortLifecycle = cleanup
  deadlineId = window.setTimeout(() => {
    timedOut = true
    cleanup()
  }, CONNECTION_TIMEOUT_MS)
  if (signal.aborted) cleanup()
  else signal.addEventListener('abort', abortLifecycle, { once: true })

  try {
    if (lifecycle.signal.aborted) throw abortError()
    const tokenResponse = await fetch('/api/realtime-token', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: lifecycle.signal,
    })
    if (!tokenResponse.ok) {
      const message = await abortable(
        readSafeError(tokenResponse, 'The voice service is unavailable.'),
        lifecycle.signal,
      )
      throw new Error(message)
    }
    const tokenPayload: unknown = await abortable(tokenResponse.json(), lifecycle.signal)
    if (!isClientSecretPayload(tokenPayload)) {
      throw new Error('The voice service returned an invalid session.')
    }

    const activePeer = new RTCPeerConnection()
    peer = activePeer
    activePeer.addTransceiver('audio', { direction: 'recvonly' })

    const activeChannel = activePeer.createDataChannel('oai-events')
    channel = activeChannel
    activeChannel.addEventListener('message', (message) => {
      if (typeof message.data !== 'string') return
      try {
        const event = JSON.parse(message.data) as RealtimeServerEvent
        if (event && typeof event.type === 'string') onEvent(event)
      } catch {
        onFailure('The voice service sent an unreadable event.')
      }
    })
    activeChannel.addEventListener('error', () => {
      if (!intentionalClose) onFailure('The voice connection reported an error.')
    })
    activePeer.addEventListener('connectionstatechange', () => {
      if (!intentionalClose && activePeer.connectionState === 'failed') {
        onFailure('The voice connection was lost.')
      }
    })

    const offer = await abortable(activePeer.createOffer(), lifecycle.signal)
    await abortable(activePeer.setLocalDescription(offer), lifecycle.signal)
    const answerResponse = await fetch(REALTIME_CALLS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenPayload.value}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
      signal: lifecycle.signal,
    })
    if (!answerResponse.ok) {
      throw new Error('The Realtime audio connection could not be established.')
    }

    const streamReady = remoteStreamPromise(activePeer, lifecycle.signal)
    // Observe cancellation immediately even while a native remote-description
    // promise is still pending; Promise.all below still consumes the result.
    void streamReady.catch(() => {})
    const answerSdp = await abortable(answerResponse.text(), lifecycle.signal)
    await abortable(
      activePeer.setRemoteDescription({ type: 'answer', sdp: answerSdp }),
      lifecycle.signal,
    )
    const [activeRemoteStream] = await Promise.all([
      streamReady,
      waitForDataChannelOpen(activeChannel, lifecycle.signal),
    ])
    remoteStream = activeRemoteStream

    // Chromium does not consistently decode an unattached remote WebRTC track
    // for MediaRecorder. A permanently muted sink activates that decode path so
    // the app can transcript-check and buffer the recording before exposing sound.
    const activeSilentSink = document.createElement('audio')
    silentSink = activeSilentSink
    activeSilentSink.autoplay = true
    activeSilentSink.defaultMuted = true
    activeSilentSink.muted = true
    activeSilentSink.volume = 0
    activeSilentSink.tabIndex = -1
    activeSilentSink.setAttribute('aria-hidden', 'true')
    activeSilentSink.setAttribute('playsinline', '')
    activeSilentSink.style.display = 'none'
    activeSilentSink.srcObject = activeRemoteStream
    document.body.append(activeSilentSink)
    try {
      await abortable(activeSilentSink.play(), lifecycle.signal)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new Error('Transcript-checked audio capture could not start.')
    }

    if (deadlineId !== null) {
      window.clearTimeout(deadlineId)
      deadlineId = null
    }
    signal.removeEventListener('abort', abortLifecycle)
    return {
      connectedAt: Date.now(),
      remoteStream: activeRemoteStream,
      send(event) {
        if (activeChannel.readyState !== 'open') throw new Error('The voice connection is not ready.')
        activeChannel.send(JSON.stringify(event))
      },
      close: cleanup,
    }
  } catch (error) {
    cleanup()
    if (timedOut) throw new Error('Voice connection timed out.')
    throw error
  }
}
