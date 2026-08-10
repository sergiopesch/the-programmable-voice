import { expect, test, type Page } from '@playwright/test'

async function installRealtimeBrowserMock(
  page: Page,
  options: {
    diverge?: boolean
    serverError?: boolean
    silent?: boolean
    audioDuration?: number
    connectionDelay?: number
    offerNeverResolves?: boolean
    sinkDelay?: number
    sinkReject?: boolean
    lateControlError?: boolean
    bufferStopDelay?: number
  } = {},
) {
  await page.addInitScript(({
    diverge,
    serverError,
    silent,
    audioDuration,
    connectionDelay,
    offerNeverResolves,
    sinkDelay,
    sinkReject,
    lateControlError,
    bufferStopDelay,
  }) => {
    const testWindow = window as typeof window & {
      __PV_AUDIO_PLAY_COUNT__?: number
      __PV_CHANNEL_CLOSE_COUNT__?: number
      __PV_PEER_CLOSE_COUNT__?: number
      __PV_CREATE_OFFER_COUNT__?: number
      __PV_RESPONSE_CREATE_COUNT__?: number
      __PV_RESPONSE_DONE_COUNT__?: number
      __PV_RESPONSE_ID_COUNTER__?: number
    }
    testWindow.__PV_AUDIO_PLAY_COUNT__ = 0
    testWindow.__PV_CHANNEL_CLOSE_COUNT__ = 0
    testWindow.__PV_PEER_CLOSE_COUNT__ = 0
    testWindow.__PV_CREATE_OFFER_COUNT__ = 0
    testWindow.__PV_RESPONSE_CREATE_COUNT__ = 0
    testWindow.__PV_RESPONSE_DONE_COUNT__ = 0
    testWindow.__PV_RESPONSE_ID_COUNTER__ = 0

    class FakeAudio {
      src = ''
      preload = ''
      onplaying: (() => void) | null = null
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      private timer: number | null = null

      setAttribute() {}
      removeAttribute(name: string) {
        if (name === 'src') this.src = ''
      }
      load() {}
      pause() {
        if (this.timer !== null) window.clearTimeout(this.timer)
        this.timer = null
      }
      play() {
        testWindow.__PV_AUDIO_PLAY_COUNT__ = (testWindow.__PV_AUDIO_PLAY_COUNT__ ?? 0) + 1
        queueMicrotask(() => this.onplaying?.())
        this.timer = window.setTimeout(() => this.onended?.(), audioDuration)
        return Promise.resolve()
      }
    }

    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported() { return true }
      state: RecordingState = 'inactive'
      mimeType = 'audio/webm;codecs=opus'
      constructor() { super() }
      start() { this.state = 'recording' }
      stop() {
        if (this.state === 'inactive') return
        this.state = 'inactive'
        queueMicrotask(() => {
          const dataEvent = new Event('dataavailable') as Event & { data: Blob }
          Object.defineProperty(dataEvent, 'data', {
            value: new Blob(['verified-test-audio'], { type: this.mimeType }),
          })
          this.dispatchEvent(dataEvent)
          this.dispatchEvent(new Event('stop'))
        })
      }
    }

    class FakeDataChannel extends EventTarget {
      readyState: RTCDataChannelState = 'open'
      send(raw: string) {
        const clientEvent = JSON.parse(raw) as {
          event_id?: string
          type: string
          response?: {
            instructions?: string
            metadata?: Record<string, string>
          }
        }
        if (clientEvent.type === 'response.cancel' || clientEvent.type === 'output_audio_buffer.clear') {
          if (lateControlError) {
            window.setTimeout(() => {
              this.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'error',
                  event_id: 'late-server-control-error',
                  error: { event_id: clientEvent.event_id, message: 'No active response.' },
                }),
              }))
            }, 25)
          }
          return
        }
        if (clientEvent.type !== 'response.create' || !clientEvent.response) return
        testWindow.__PV_RESPONSE_CREATE_COUNT__ = (testWindow.__PV_RESPONSE_CREATE_COUNT__ ?? 0) + 1
        const nextResponseId = (testWindow.__PV_RESPONSE_ID_COUNTER__ ?? 0) + 1
        testWindow.__PV_RESPONSE_ID_COUNTER__ = nextResponseId
        const responseId = `response-${nextResponseId}`
        const instructions = clientEvent.response.instructions ?? ''
        const passage = instructions.match(/<BOOK_PASSAGE>\n([\s\S]*?)\n<\/BOOK_PASSAGE>/)?.[1] ?? ''
        const transcript = diverge ? 'This sentence was not in the manuscript.' : passage
        const metadata = clientEvent.response.metadata ?? {}
        const emit = (payload: Record<string, unknown>) => {
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }))
        }
        if (silent) return
        window.setTimeout(() => {
          if (serverError) {
            emit({
              type: 'error',
              event_id: 'server-event-not-the-client-request',
              error: { message: 'Rejected for test.' },
            })
            return
          }
          emit({ type: 'response.created', response: { id: responseId, metadata } })
          emit({ type: 'response.output_audio_transcript.done', response_id: responseId, transcript })
          emit({
            type: 'response.done',
            response: {
              id: responseId,
              status: 'completed',
              metadata,
              output: [{ content: [{ transcript }] }],
            },
          })
          testWindow.__PV_RESPONSE_DONE_COUNT__ = (testWindow.__PV_RESPONSE_DONE_COUNT__ ?? 0) + 1
          window.setTimeout(
            () => emit({ type: 'output_audio_buffer.stopped', response_id: responseId }),
            bufferStopDelay,
          )
        }, 5)
      }
      close() {
        this.readyState = 'closed'
        testWindow.__PV_CHANNEL_CLOSE_COUNT__ = (testWindow.__PV_CHANNEL_CLOSE_COUNT__ ?? 0) + 1
      }
    }

    class FakePeerConnection extends EventTarget {
      connectionState: RTCPeerConnectionState = 'connected'
      private channel = new FakeDataChannel()
      addTransceiver() { return {} as RTCRtpTransceiver }
      createDataChannel() { return this.channel as unknown as RTCDataChannel }
      async createOffer() {
        testWindow.__PV_CREATE_OFFER_COUNT__ = (testWindow.__PV_CREATE_OFFER_COUNT__ ?? 0) + 1
        if (offerNeverResolves) return new Promise<RTCSessionDescriptionInit>(() => {})
        return { type: 'offer' as RTCSdpType, sdp: 'fake-offer' }
      }
      async setLocalDescription() {}
      async setRemoteDescription() {
        const dispatchTrack = () => {
          const trackEvent = new Event('track') as Event & { streams: MediaStream[]; track: MediaStreamTrack }
          const stream = new MediaStream()
          Object.defineProperties(trackEvent, {
            streams: { value: [stream] },
            track: { value: {} },
          })
          this.dispatchEvent(trackEvent)
        }
        if (connectionDelay > 0) {
          await new Promise<void>((resolve) => window.setTimeout(() => {
            dispatchTrack()
            resolve()
          }, connectionDelay))
        } else dispatchTrack()
      }
      close() {
        this.connectionState = 'closed'
        testWindow.__PV_PEER_CLOSE_COUNT__ = (testWindow.__PV_PEER_CLOSE_COUNT__ ?? 0) + 1
      }
    }

    Object.defineProperty(window, 'Audio', { configurable: true, value: FakeAudio })
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder })
    Object.defineProperty(window, 'RTCPeerConnection', { configurable: true, value: FakePeerConnection })
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() {
        if (sinkReject) return Promise.reject(new DOMException('Sink rejected for test.', 'NotAllowedError'))
        if (sinkDelay > 0) {
          return new Promise<void>((resolve) => window.setTimeout(resolve, sinkDelay))
        }
        return Promise.resolve()
      },
    })
  }, {
    diverge: options.diverge ?? false,
    serverError: options.serverError ?? false,
    silent: options.silent ?? false,
    audioDuration: options.audioDuration ?? 750,
    connectionDelay: options.connectionDelay ?? 0,
    offerNeverResolves: options.offerNeverResolves ?? false,
    sinkDelay: options.sinkDelay ?? 0,
    sinkReject: options.sinkReject ?? false,
    lateControlError: options.lateControlError ?? false,
    bufferStopDelay: options.bufferStopDelay ?? 0,
  })
}

async function mockRealtimeNetwork(page: Page) {
  let tokenRequests = 0
  await page.route('**/api/realtime-token', async (route) => {
    tokenRequests += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: 'ephemeral-test-token', expires_at: 1_900_000_000 }),
    })
  })
  await page.route('https://api.openai.com/v1/realtime/calls', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/sdp', body: 'fake-answer' })
  })
  return () => tokenRequests
}

test('Realtime narration is user-initiated, transcript-checked, pausable and stoppable', async ({ page }) => {
  await installRealtimeBrowserMock(page)
  const tokenRequests = await mockRealtimeNetwork(page)
  await page.goto('/#breath-pressure')

  expect(tokenRequests()).toBe(0)
  await page.getByRole('button', { name: 'Listen from this section' }).click()
  await expect(page.getByRole('region', { name: 'OpenAI Realtime narration' })).toBeVisible()
  await expect(page.getByText('Reading · transcript checked')).toBeVisible()
  expect(tokenRequests()).toBe(1)
  await expect(page.locator('.narration-target--active')).toHaveCount(1)

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeFocused()
  await expect(page.locator('.narration-target--active')).toHaveCount(0)

  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByText('Reading · transcript checked')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Stop narration' }).click()
  await expect(page.getByRole('region', { name: 'OpenAI Realtime narration' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Listen from this section' })).toBeFocused()
})

test('a divergent generated transcript is never played', async ({ page }) => {
  await installRealtimeBrowserMock(page, { diverge: true })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()

  await expect(page.getByRole('alert')).toContainText('did not match the manuscript')
  await expect(page.locator('.narration-target--active')).toHaveCount(0)
  expect(await page.evaluate(() => (window as typeof window & { __PV_AUDIO_PLAY_COUNT__?: number }).__PV_AUDIO_PLAY_COUNT__)).toBe(0)
  await expect(page).toHaveURL(/#voice-editable$/)
})

test('an uncorrelated server error stops narration instead of leaving verification pending', async ({ page }) => {
  await installRealtimeBrowserMock(page, { serverError: true })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()

  await expect(page.getByRole('alert')).toContainText('rejected the narration request')
  await expect(page.getByText('Checking next transcript')).toHaveCount(0)
})

test('a silent response times out instead of leaving transcript checking pending', async ({ page }) => {
  await page.clock.install()
  await installRealtimeBrowserMock(page, { silent: true })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()
  await expect(page.getByText('Checking next transcript')).toBeVisible()

  await page.clock.fastForward(31_000)
  await expect(page.getByRole('alert')).toContainText('stopped responding')
})

test('the decode sink is ready before the first response is requested', async ({ page }) => {
  await installRealtimeBrowserMock(page, { sinkDelay: 350 })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()

  await page.waitForTimeout(100)
  expect(await page.evaluate(() => (
    window as typeof window & { __PV_RESPONSE_CREATE_COUNT__?: number }
  ).__PV_RESPONSE_CREATE_COUNT__)).toBe(0)
  await expect(page.getByText('Reading · transcript checked')).toBeVisible()
})

test('a rejected decode sink fails safely before requesting audio', async ({ page }) => {
  await installRealtimeBrowserMock(page, { sinkReject: true })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()

  await expect(page.getByRole('alert')).toContainText('audio capture could not start')
  expect(await page.evaluate(() => (
    window as typeof window & { __PV_RESPONSE_CREATE_COUNT__?: number }
  ).__PV_RESPONSE_CREATE_COUNT__)).toBe(0)
})

test('pausing while connecting aborts the pending handshake', async ({ page }) => {
  await installRealtimeBrowserMock(page, { offerNeverResolves: true })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __PV_CREATE_OFFER_COUNT__?: number }
  ).__PV_CREATE_OFFER_COUNT__)).toBe(1)

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => ({
    channel: (window as typeof window & { __PV_CHANNEL_CLOSE_COUNT__?: number }).__PV_CHANNEL_CLOSE_COUNT__,
    peer: (window as typeof window & { __PV_PEER_CLOSE_COUNT__?: number }).__PV_PEER_CLOSE_COUNT__,
  }))).toEqual({ channel: 1, peer: 1 })
})

test('the complete connection handshake has a bounded deadline', async ({ page }) => {
  await page.clock.install()
  await installRealtimeBrowserMock(page, { offerNeverResolves: true })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __PV_CREATE_OFFER_COUNT__?: number }
  ).__PV_CREATE_OFFER_COUNT__)).toBe(1)

  await page.clock.fastForward(21_000)
  await expect(page.getByRole('alert')).toContainText('Voice connection timed out')
})

test('a late control error from Pause cannot fail the resumed passage', async ({ page }) => {
  await installRealtimeBrowserMock(page, {
    lateControlError: true,
    bufferStopDelay: 1_000,
  })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __PV_RESPONSE_DONE_COUNT__?: number }
  ).__PV_RESPONSE_DONE_COUNT__)).toBe(1)

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByText('Reading · transcript checked')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('stopping during connection closes pending WebRTC resources', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await installRealtimeBrowserMock(page, { connectionDelay: 5_000 })
  await mockRealtimeNetwork(page)
  await page.goto('/#voice-editable')
  await page.getByRole('button', { name: 'Listen from this section' }).click()
  await page.getByRole('button', { name: 'Stop narration' }).click()
  await expect(page.getByRole('region', { name: 'OpenAI Realtime narration' })).toHaveCount(0)

  await expect.poll(() => page.evaluate(() => ({
    channel: (window as typeof window & { __PV_CHANNEL_CLOSE_COUNT__?: number }).__PV_CHANNEL_CLOSE_COUNT__,
    peer: (window as typeof window & { __PV_PEER_CLOSE_COUNT__?: number }).__PV_PEER_CLOSE_COUNT__,
  }))).toEqual({ channel: 1, peer: 1 })
  expect(pageErrors).toEqual([])
})

test('transcript-checked playback advances the page and reading target automatically', async ({ page }) => {
  await installRealtimeBrowserMock(page, { audioDuration: 1_500 })
  await mockRealtimeNetwork(page)
  await page.goto('/#opening')
  await page.getByRole('button', { name: 'Listen from this section' }).click()

  await expect(page.locator('#narration-breath-pressure-header')).toHaveClass(/narration-target--active/)
  await expect(page).toHaveURL(/#breath-pressure$/, { timeout: 5_000 })
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused()
  await expect(page.locator('.narration-target--active')).toHaveCount(1)
  await page.getByRole('button', { name: 'Stop narration' }).click()
})

test('sources are hidden by default and reveal as a focused animated drawer', async ({ page }) => {
  await page.goto('/#breath-pressure')
  const drawer = page.getByRole('dialog', { name: /Evidence/ })
  await expect(drawer).not.toBeVisible()

  const sourcesButton = page.getByRole('button', { name: /Sources/ })
  await expect(sourcesButton).toHaveAttribute('aria-expanded', 'false')
  await sourcesButton.click()
  await expect(drawer).toBeVisible()
  await expect(sourcesButton).toHaveAttribute('aria-expanded', 'true')
  await expect(drawer.locator('.source-entry').first()).toBeVisible()
  expect(await drawer.evaluate((element) => getComputedStyle(element).animationName)).toBe('evidence-drawer-in')
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(sourcesButton).toBeFocused()

  await page.locator('.citation').first().click()
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('.source-entry--selected')).toBeFocused()
})
