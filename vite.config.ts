import { readFile } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { renderStaticManuscript } from './build/staticManuscript'

const narrationReviewRoute = '/__narration-review/candidate-manifest.json'
const narrationCandidatePath = fileURLToPath(new URL('./.narration-work/candidate-manifest.json', import.meta.url))

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Robots-Tag', 'noindex, noarchive')
  response.end(`${JSON.stringify(body)}\n`)
}

function isCompleteUnreleasedCandidate(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  const generationScope = candidate.generationScope as Record<string, unknown> | null
  return candidate.schemaVersion === 1
    && candidate.complete === true
    && candidate.approved === false
    && candidate.approval === null
    && typeof candidate.releaseId === 'string'
    && candidate.releaseId.length > 0
    && typeof candidate.releaseManifestUrl === 'string'
    && candidate.releaseManifestUrl.length > 0
    && Array.isArray(candidate.passages)
    && candidate.passageCount === candidate.passages.length
    && generationScope?.mode === 'full'
    && generationScope.requestedPassageCount === candidate.passageCount
}

function narrationReviewPlugin(): Plugin {
  return {
    name: 'narration-review-candidate',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== narrationReviewRoute) {
          next()
          return
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.setHeader('Allow', 'GET, HEAD')
          sendJson(response, 405, { error: 'Method not allowed.' })
          return
        }

        try {
          const source = await readFile(narrationCandidatePath, 'utf8')
          const candidate = JSON.parse(source) as unknown
          if (!isCompleteUnreleasedCandidate(candidate)) {
            sendJson(response, 409, { error: 'The unreleased narration candidate is not complete.' })
            return
          }
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('X-Robots-Tag', 'noindex, noarchive')
          response.end(request.method === 'HEAD' ? undefined : source)
        } catch (error) {
          const code = error && typeof error === 'object' && 'code' in error ? error.code : null
          if (code === 'ENOENT') {
            sendJson(response, 404, { error: 'The unreleased narration candidate is not ready.' })
            return
          }
          sendJson(response, 503, { error: 'The unreleased narration candidate could not be read.' })
        }
      })
    },
  }
}

function staticManuscriptPlugin(): Plugin {
  const manuscript = renderStaticManuscript()
  return {
    name: 'static-manuscript',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/manuscript.html') {
          next()
          return
        }
        response.statusCode = 200
        response.setHeader('Content-Type', 'text/html; charset=utf-8')
        response.end(manuscript)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manuscript.html', source: manuscript })
    },
  }
}

export default defineConfig({
  plugins: [react(), narrationReviewPlugin(), staticManuscriptPlugin()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
})
