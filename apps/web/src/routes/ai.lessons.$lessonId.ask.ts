import { createFileRoute } from '@tanstack/react-router'
import { createLimiter } from '../lib/ai-limit'
import { configFromEnv, handleAsk } from '../lib/ai-server'

// 20 questions per session per hour.
const limiter = createLimiter(20, 60 * 60 * 1000)

export const Route = createFileRoute('/ai/lessons/$lessonId/ask')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const config = configFromEnv(process.env)
        return handleAsk(request, params.lessonId, {
          config,
          limiter,
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
