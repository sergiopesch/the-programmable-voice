import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { renderStaticManuscript } from './build/staticManuscript'

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
  plugins: [react(), staticManuscriptPlugin()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
})
