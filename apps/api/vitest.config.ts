import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Parallel DB suites create/migrate/drop databases and truncate between tests.
    // Under CPU load these exceed Vitest's default 5s test / 10s hook budgets.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
