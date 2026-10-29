import { createHash } from 'node:crypto'
import type { Limiter } from './ai-limit'
import {
  MAX_OUTPUT_TOKENS,
  buildPrompt,
  cleanQuestion,
  lessonContext,
} from './ai-prompt'

export type AiConfig = { apiKey: string; model: string }

export type TextStream = (input: {
  system: string
  user: string
  model: string
  maxTokens: number
  signal: AbortSignal
}) => AsyncIterable<string>

export type AskDeps = {
  config: AiConfig | null
  /** Per session: keyed on the session cookie value only. */
  limiter: Limiter
  /** One budget for every session together, a cap on model cost. */
  globalLimiter: Limiter
  apiBase: string
  fetchImpl?: typeof fetch
  stream: TextStream
}

const PREVIEW_HEADER = 'X-Tilchi-Preview-Role'
const SESSION_COOKIE = '__Host-tilchi_sid'

// The API mints base64url(32 bytes). Only that exact shape is accepted, so
// "%61bc"-style encodings of one session cannot mint fresh limiter keys.
const SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/

/** The session cookie value, ignoring every other cookie in the header. */
export function sessionCookie(header: string): string | null {
  for (const part of header.split(';')) {
    const at = part.indexOf('=')
    if (at < 0) continue
    if (part.slice(0, at).trim() !== SESSION_COOKIE) continue
    const value = part.slice(at + 1).trim()
    return SESSION_TOKEN.test(value) ? value : null
  }
  return null
}
const LESSON_ID = /^[\w-]{1,64}$/

const json = (status: number, error: string, extra: HeadersInit = {}) =>
  Response.json({ error }, { status, headers: extra })

/** Default Anthropic, model from env. Other providers are not wired in v1. */
export function configFromEnv(
  env: Record<string, string | undefined>,
): AiConfig | null {
  if ((env.AI_PROVIDER ?? 'anthropic') !== 'anthropic') return null
  const apiKey = env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  return { apiKey, model: env.AI_MODEL?.trim() || 'claude-sonnet-5-5' }
}

export async function handleAsk(
  request: Request,
  lessonId: string,
  deps: AskDeps,
): Promise<Response> {
  if (!deps.config) return json(503, 'ai_disabled')
  if (!LESSON_ID.test(lessonId)) return json(404, 'not_found')

  const session = sessionCookie(request.headers.get('cookie') ?? '')
  if (!session) return json(401, 'unauthorized')

  // Membership is the API's call: it answers 401/403/404 for non-members.
  // Only the session cookie is forwarded, so the limiter key below is the
  // same identity the API just authorized.
  const headers = new Headers({ cookie: `${SESSION_COOKIE}=${session}` })
  const preview = request.headers.get(PREVIEW_HEADER)
  if (preview) headers.set(PREVIEW_HEADER, preview)
  let lessonResponse: Response
  try {
    lessonResponse = await (deps.fetchImpl ?? fetch)(
      `${deps.apiBase}/api/lessons/${lessonId}`,
      { headers },
    )
  } catch {
    return json(502, 'upstream_unavailable')
  }
  if ([401, 403, 404].includes(lessonResponse.status)) {
    return json(lessonResponse.status, 'forbidden')
  }
  if (!lessonResponse.ok) return json(502, 'upstream_unavailable')
  const context = lessonContext(await lessonResponse.json().catch(() => null))
  if (!context) return json(502, 'upstream_unavailable')

  const body = (await request.json().catch(() => null)) as {
    question?: unknown
  } | null
  const question = cleanQuestion(body?.question)
  if (!question) return json(400, 'invalid_question')

  const key = createHash('sha256').update(session).digest('hex')
  // Check the session first without recording, then spend the global budget,
  // then the session's: a global outage never burns a learner's own budget,
  // and an already-limited session never drains the shared one.
  const wait =
    deps.limiter.check(key) ||
    deps.globalLimiter.hit('all') ||
    deps.limiter.hit(key)
  if (wait > 0) return json(429, 'rate_limited', { 'retry-after': `${wait}` })

  const prompt = buildPrompt(context, question)
  const iterator = deps
    .stream({
      ...prompt,
      model: deps.config.model,
      maxTokens: MAX_OUTPUT_TOKENS,
      signal: request.signal,
    })
    [Symbol.asyncIterator]()
  const encoder = new TextEncoder()
  const readable = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next()
        if (next.done) controller.close()
        else controller.enqueue(encoder.encode(next.value))
      } catch (error) {
        controller.error(error)
      }
    },
    cancel: () => void iterator.return?.(),
  })
  return new Response(readable, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  })
}
