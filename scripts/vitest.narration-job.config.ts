import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'scripts/narration-local-engine.test.ts',
      'scripts/narration-loudness.test.ts',
      'scripts/narration-pacing.test.ts',
      'scripts/narration-pilot-contract.test.ts',
      'scripts/narration-review-contract.test.ts',
      'scripts/narration-verification-parity.test.ts',
    ],
  },
})
