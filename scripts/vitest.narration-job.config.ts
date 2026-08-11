import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'scripts/narration-job-lib.test.ts',
      'scripts/narration-vercel-job.test.ts',
    ],
  },
})
