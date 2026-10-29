import { describe, expect, it } from 'vitest'
import { createLimiter } from './ai-limit'
import {
  type AskDeps,
  type TextStream,
  configFromEnv,
  handleAsk,
} from './ai-server'

const tok = (c: string) => c.repeat(43)
const A = tok('a')

const lessonBody = {
  lesson: { id: 'l1', scheduledAt: '2026-11-02T10:00:00.000Z' },
  group: { id: 'g1', name: 'IELTS 7', level: 'B2' },
}

function setup(over: Partial<AskDeps> = {}) {
  const calls: { url: string; headers: Headers }[] = []
  const prompts: Parameters<TextStream>[0][] = []
  const deps: AskDeps = {
    config: { apiKey: 'k', model: 'm' },
    limiter: createLimiter(2, 1000, () => 0),
    globalLimiter: createLimiter(100, 1000, () => 0),
    apiBase: 'http://api',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers) })
      return Response.json(lessonBody)
    },
    stream: async function* (input) {
      prompts.push(input)
      yield 'Hel'
      yield 'lo'
    },
    ...over,
  }
  const ask = (
    body: unknown = { question: 'What is a gerund?' },
    headers: Record<string, string> = { cookie: `__Host-tilchi_sid=${A}` },
  ) =>
    handleAsk(
      new Request('http://web/ai/lessons/l1/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
      'l1',
      deps,
    )
  return { ask, calls, prompts }
}

describe('handleAsk', () => {
  it('is 503 ai_disabled without a key, before touching the API', async () => {
    const { ask, calls } = setup({ config: null })
    const res = await ask()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'ai_disabled' })
    expect(calls).toHaveLength(0)
  })

  it('is 401 without a session cookie', async () => {
    const { ask, calls } = setup()
    expect((await ask(undefined, {})).status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it.each([401, 403, 404])(
    'passes API %i through and never calls the model',
    async (status) => {
      const { ask, prompts } = setup({
        fetchImpl: async () => new Response('{}', { status }),
      })
      expect((await ask()).status).toBe(status)
      expect(prompts).toHaveLength(0)
    },
  )

  it('is 502 when the API fails or is unreachable', async () => {
    const down = setup({
      fetchImpl: async () => new Response('', { status: 500 }),
    })
    expect((await down.ask()).status).toBe(502)
    const dead = setup({
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED')
      },
    })
    expect((await dead.ask()).status).toBe(502)
  })

  it('forwards only the session cookie and the preview role', async () => {
    const { ask, calls } = setup()
    await ask(undefined, {
      cookie: `theme=dark; __Host-tilchi_sid=${A}`,
      'X-Tilchi-Preview-Role': 'teacher',
    })
    expect(calls[0]?.url).toBe('http://api/api/lessons/l1')
    expect(calls[0]?.headers.get('cookie')).toBe(`__Host-tilchi_sid=${A}`)
    expect(calls[0]?.headers.get('X-Tilchi-Preview-Role')).toBe('teacher')
  })

  it('rejects a bad lesson id and a bad question', async () => {
    const { ask } = setup()
    expect((await ask({ question: '' })).status).toBe(400)
    expect((await ask({})).status).toBe(400)
    const res = await handleAsk(
      new Request('http://web/x', {
        method: 'POST',
        headers: { cookie: `__Host-tilchi_sid=${A}` },
      }),
      '../etc',
      {
        config: { apiKey: 'k', model: 'm' },
        limiter: createLimiter(1, 1),
        globalLimiter: createLimiter(1, 1),
        apiBase: 'x',
        stream: async function* () {},
      },
    )
    expect(res.status).toBe(404)
  })

  it('streams the answer with the stripped, lesson-only prompt', async () => {
    const { ask, prompts } = setup()
    const res = await ask({ question: 'Explain gerunds, my id is 540152508' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Hello')
    expect(prompts[0]?.user).not.toContain('IELTS 7')
    expect(prompts[0]?.user).toContain('Level: B2')
    expect(prompts[0]?.user).not.toContain('540152508')
    expect(prompts[0]).toMatchObject({ model: 'm', maxTokens: 600 })
  })

  it('rate limits per session with Retry-After, and other sessions are free', async () => {
    const { ask } = setup()
    expect((await ask()).status).toBe(200)
    expect((await ask()).status).toBe(200)
    const limited = await ask()
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('1')
    expect(
      (await ask(undefined, { cookie: `__Host-tilchi_sid=${tok('o')}` }))
        .status,
    ).toBe(200)
  })

  it('keys the budget on the session cookie only, not on other cookies', async () => {
    const { ask } = setup()
    for (const junk of ['x=1', 'x=2']) {
      const cookie = `${junk}; __Host-tilchi_sid=${A}`
      expect((await ask(undefined, { cookie })).status).toBe(200)
    }
    const res = await ask(undefined, { cookie: `x=3; __Host-tilchi_sid=${A}` })
    expect(res.status).toBe(429)
  })

  it('is 401 without the session cookie, even with other cookies', async () => {
    const { ask, calls } = setup()
    expect((await ask(undefined, { cookie: 'x=1' })).status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('rejects a non-canonical session value, so encodings cannot mint new budgets', async () => {
    const { ask, calls } = setup()
    const encoded = `__Host-tilchi_sid=%61${'a'.repeat(42)}`
    expect((await ask(undefined, { cookie: encoded })).status).toBe(401)
    expect(
      (await ask(undefined, { cookie: '__Host-tilchi_sid=short' })).status,
    ).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('does not spend a session budget while the global budget is exhausted', async () => {
    let global = 1
    const globalLimiter = {
      check: () => (global > 0 ? 0 : 60),
      hit: () => (global-- > 0 ? 0 : 60),
    }
    const { ask } = setup({ globalLimiter })
    expect((await ask()).status).toBe(200)
    for (let i = 0; i < 3; i++) expect((await ask()).status).toBe(429)
    global = 5
    expect((await ask()).status).toBe(200)
  })

  it('caps all sessions together with a global hourly budget', async () => {
    const { ask } = setup({ globalLimiter: createLimiter(2, 1000, () => 0) })
    for (const sid of ['a', 'b']) {
      const cookie = `__Host-tilchi_sid=${tok(sid)}`
      expect((await ask(undefined, { cookie })).status).toBe(200)
    }
    const res = await ask(undefined, {
      cookie: `__Host-tilchi_sid=${tok('c')}`,
    })
    expect(res.status).toBe(429)
  })

  it('refuses an oversized body with 413 before parsing it', async () => {
    const { ask, prompts } = setup()
    const res = await ask({ question: 'a'.repeat(20_000) })
    expect(res.status).toBe(413)
    expect(prompts).toHaveLength(0)
  })

  it('does not spend the budget on an invalid question', async () => {
    const { ask } = setup()
    for (let i = 0; i < 5; i++) await ask({ question: '' })
    expect((await ask()).status).toBe(200)
  })
})

describe('createLimiter', () => {
  it('frees the budget once the window has passed', () => {
    let t = 0
    const limiter = createLimiter(1, 1000, () => t)
    expect(limiter.hit('a')).toBe(0)
    expect(limiter.hit('a')).toBe(1)
    t = 1000
    expect(limiter.hit('a')).toBe(0)
  })

  it('keeps at most maxKeys entries, dropping the least recent key', () => {
    const limiter = createLimiter(1, 1000, () => 0, 2)
    limiter.hit('a')
    limiter.hit('b')
    expect(limiter.hit('a')).toBe(1)
    limiter.hit('c')
    expect(limiter.hit('a')).toBe(1)
    expect(limiter.hit('b')).toBe(0)
  })
})

describe('configFromEnv', () => {
  it('needs a key; defaults to Anthropic claude-sonnet-5-5; model from env', () => {
    expect(configFromEnv({})).toBeNull()
    expect(configFromEnv({ ANTHROPIC_API_KEY: '  ' })).toBeNull()
    expect(configFromEnv({ ANTHROPIC_API_KEY: 'k' })).toEqual({
      apiKey: 'k',
      model: 'claude-sonnet-5-5',
    })
    expect(
      configFromEnv({ ANTHROPIC_API_KEY: 'k', AI_MODEL: 'x' })?.model,
    ).toBe('x')
  })

  it('is disabled for a provider that is not wired', () => {
    expect(
      configFromEnv({ ANTHROPIC_API_KEY: 'k', AI_PROVIDER: 'openai' }),
    ).toBeNull()
  })
})
