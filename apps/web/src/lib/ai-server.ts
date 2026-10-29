import type { Limiter } from './ai-limit'
import type { AppRole } from './nav'
import { parsePreviewRole } from './preview'
import {
  MAX_OUTPUT_TOKENS,
  buildPrompt,
  cleanQuestion,
  mentionsOwnName,
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
  /** Per account: keyed on the userId the API returns for the session. */
  limiter: Limiter
  /** One budget for every session together, a cap on model cost. */
  globalLimiter: Limiter
  apiBase: string
  fetchImpl?: typeof fetch
  stream: TextStream
  /** Dev/test only: a preview role may stand in for a missing account. */
  previewAllowed?: boolean
}

const PREVIEW_HEADER = 'X-Tilchi-Preview-Role'
const SESSION_COOKIE = '__Host-tilchi_sid'
const MAX_BODY_BYTES = 8 * 1024

/** The body as text, or null once it passes `max` bytes (the stream is cancelled). */
export async function readLimited(
  request: Request,
  max: number,
): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      // Fire and forget: a stream whose cancel never settles must not hang us.
      reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

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

// The budget follows the account, not the session cookie: logging in again
// mints a new cookie but must not mint a new budget (XAM-897). With no
// account, dev/test preview shares one budget per known role; anywhere else
// it is 502, because the session can expire between the lesson call and
// this one and the preview header is the client's to choose.
async function accountKey(
  fetchImpl: typeof fetch,
  apiBase: string,
  headers: Headers,
  preview: AppRole | null,
): Promise<string | null> {
  try {
    const res = await fetchImpl(`${apiBase}/auth/session`, { headers })
    if (!res.ok) return null
    const body = (await res.json()) as { user?: { userId?: unknown } | null }
    const id = body?.user?.userId
    if (typeof id === 'string' && id !== '') return `user:${id}`
    return preview ? `preview:${preview}` : null
  } catch {
    return null
  }
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
  const fetchImpl = deps.fetchImpl ?? fetch
  const lesson = fetchImpl(`${deps.apiBase}/api/lessons/${lessonId}`, {
    headers,
  })
  // In parallel; never rejects, so an early return leaves nothing unhandled.
  const account = accountKey(
    fetchImpl,
    deps.apiBase,
    headers,
    deps.previewAllowed ? parsePreviewRole(preview) : null,
  )
  let lessonResponse: Response
  try {
    lessonResponse = await lesson
  } catch {
    return json(502, 'upstream_unavailable')
  }
  if ([401, 403, 404].includes(lessonResponse.status)) {
    return json(lessonResponse.status, 'forbidden')
  }
  if (!lessonResponse.ok) return json(502, 'upstream_unavailable')
  const context = lessonContext(await lessonResponse.json().catch(() => null))
  if (!context) return json(502, 'upstream_unavailable')

  // A question is ≤ 600 chars: stop reading past 8 KB, without waiting for EOF.
  const raw = await readLimited(request, MAX_BODY_BYTES)
  if (raw === null) return json(413, 'too_large')
  let body: { question?: unknown } | null = null
  try {
    body = JSON.parse(raw)
  } catch {
    body = null
  }
  const question = cleanQuestion(body?.question)
  if (!question) return json(400, 'invalid_question')
  // Check the raw text too: redaction can swallow a sentence end.
  if (mentionsOwnName(String(body?.question)) || mentionsOwnName(question))
    return json(422, 'personal_info')

  const key = await account
  if (!key) return json(502, 'upstream_unavailable')
  // Check the account first without recording, then spend the global budget,
  // then the account's: a global outage never burns a learner's own budget,
  // and an already-limited account never drains the shared one.
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
