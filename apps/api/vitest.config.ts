import { defineConfig } from 'vitest/config'

// Tests that boot the real app start an in-process Postgres and run the
// migration (about a second here), so shared CI runners get more headroom.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
})
