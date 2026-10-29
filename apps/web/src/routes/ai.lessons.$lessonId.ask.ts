import { createFileRoute } from '@tanstack/react-router'
import { createLimiter } from '../lib/ai-limit'
import { configFromEnv, handleAsk } from '../lib/ai-server'

const HOUR = 60 * 60 * 1000
// 20 questions per session per hour; 300 per hour for everyone together.
const limiter = createLimiter(20, HOUR)
const globalLimiter = createLimiter(300, HOUR)

export const Route = createFileRoute('/ai/lessons/$lessonId/ask')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const config = configFromEnv(process.env)
        return handleAsk(request, params.lessonId, {
          config,
          limiter,
          globalLimiter,
          apiBase: process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001',
          stream: async function* (input) {
            const { anthropicStream } = await import('../lib/ai-anthropic')
            // config is non-null here: handleAsk answers 503 before streaming.
            yield* anthropicStream(config as NonNullable<typeof config>)(input)
          },
        })
      },
    },
  },
})
