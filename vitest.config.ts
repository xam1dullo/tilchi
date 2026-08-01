import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
  resolve: {
    alias: {
      '@/content': fileURLToPath(new URL('./content', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@velite': fileURLToPath(new URL('.velite', import.meta.url)),
    },
  },
})
