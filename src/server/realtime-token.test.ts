import { describe, expect, it } from 'vitest'
import { handleRealtimeTokenRequest } from '../../api/realtime-token'

const endpoint = 'https://voice.example/api/realtime-token'

describe('Realtime client-secret endpoint', () => {
  it('accepts POST only and never calls OpenAI for another method', async () => {
    let fetchCalls = 0
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1
      return Response.json({})
    }

    const response = await handleRealtimeTokenRequest(new Request(endpoint), {
      apiKey: 'sk-test-server-only',
      fetch: fetchImpl,
    })

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({ error: 'Method not allowed.' })
    expect(fetchCalls).toBe(0)
  })

  it('fails safely when the server key is missing', async () => {
    let fetchCalls = 0
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1
      return Response.json({})
    }

    const response = await handleRealtimeTokenRequest(
      new Request(endpoint, { method: 'POST' }),
      { apiKey: undefined, fetch: fetchImpl },
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Voice service is not configured.' })
    expect(fetchCalls).toBe(0)
  })

  it('rejects cross-origin token minting before calling OpenAI', async () => {
    let fetchCalls = 0
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1
      return Response.json({})
    }

    const response = await handleRealtimeTokenRequest(
      new Request(endpoint, {
        method: 'POST',
        headers: {
          host: 'voice.example',
          origin: 'https://attacker.example',
        },
      }),
      { apiKey: 'sk-test-server-only', fetch: fetchImpl },
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({ error: 'Origin not allowed.' })
    expect(fetchCalls).toBe(0)
  })

  it('sends a fixed audio-only reader session and returns only the ephemeral secret', async () => {
    let capturedInput: Parameters<typeof fetch>[0] | undefined
    let capturedInit: Parameters<typeof fetch>[1]
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = input
      capturedInit = init
      return Response.json({
        expires_at: 1_800_000_000,
        session: { id: 'realtime-session-metadata' },
        value: 'ek_test_browser_secret',
      })
    }

    const response = await handleRealtimeTokenRequest(
      new Request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: { model: 'attacker-model', tools: [{ type: 'function' }], voice: 'attacker-voice' },
        }),
      }),
      { apiKey: 'sk-test-server-only', fetch: fetchImpl },
    )

    expect(capturedInput).toBe('https://api.openai.com/v1/realtime/client_secrets')
    expect(capturedInit?.method).toBe('POST')
    const headers = new Headers(capturedInit?.headers)
    expect(headers.get('authorization')).toBe('Bearer sk-test-server-only')
    expect(headers.get('content-type')).toBe('application/json')

    const body = JSON.parse(String(capturedInit?.body))
    expect(body).toEqual({
      session: {
        type: 'realtime',
        model: 'gpt-realtime-2.1',
        output_modalities: ['audio'],
        audio: { output: { voice: 'marin' } },
        instructions: expect.stringMatching(
          /Read aloud only the passage supplied by the application.*feminine British book-narration voice/,
        ),
        tool_choice: 'none',
        tools: [],
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({
      value: 'ek_test_browser_secret',
      expires_at: 1_800_000_000,
    })
  })

  it('does not expose an upstream API error', async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        { error: { message: 'Invalid API key: sk-upstream-secret-detail' } },
        { status: 401 },
      )

    const response = await handleRealtimeTokenRequest(
      new Request(endpoint, { method: 'POST' }),
      { apiKey: 'sk-test-server-only', fetch: fetchImpl },
    )
    const responseText = await response.text()

    expect(response.status).toBe(502)
    expect(responseText).toBe('{"error":"Voice session unavailable."}')
    expect(responseText).not.toContain('sk-upstream-secret-detail')
  })

  it('handles network and malformed-response failures without details', async () => {
    const networkFailure: typeof fetch = async () => {
      throw new Error('network detail')
    }
    const malformedResponse: typeof fetch = async () => Response.json({ value: 'missing-expiry' })

    const networkResponse = await handleRealtimeTokenRequest(
      new Request(endpoint, { method: 'POST' }),
      { apiKey: 'sk-test-server-only', fetch: networkFailure },
    )
    const malformedResponseResult = await handleRealtimeTokenRequest(
      new Request(endpoint, { method: 'POST' }),
      { apiKey: 'sk-test-server-only', fetch: malformedResponse },
    )

    expect(networkResponse.status).toBe(502)
    expect(await networkResponse.json()).toEqual({ error: 'Voice session unavailable.' })
    expect(malformedResponseResult.status).toBe(502)
    expect(await malformedResponseResult.json()).toEqual({ error: 'Voice session unavailable.' })
  })
})
