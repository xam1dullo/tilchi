import { describe, expect, it } from 'vitest'
import { askHelper } from './ai-client'
import {
  type AiAction,
  type AiState,
  failureForStatus,
  initialAi,
  reduceAi,
} from './ai-sheet'

const run = (actions: AiAction[], from: AiState = initialAi) =>
  actions.reduce(reduceAi, from)

describe('reduceAi', () => {
  it('asks, streams chunks into the last row, then finishes', () => {
    const state = run([
      { type: 'ask', question: ' What is a gerund? ' },
      { type: 'chunk', text: 'A verb ' },
      { type: 'chunk', text: 'as noun.' },
      { type: 'done' },
    ])
    expect(state).toEqual({
      rows: [
        { id: 1, question: 'What is a gerund?', answer: 'A verb as noun.' },
      ],
      streaming: false,
      failure: null,
    })
  })

  it('ignores blank questions and a second ask while streaming', () => {
    expect(run([{ type: 'ask', question: '  ' }])).toBe(initialAi)
    const busy = run([{ type: 'ask', question: 'a' }])
    expect(reduceAi(busy, { type: 'ask', question: 'b' })).toBe(busy)
  })

  it('ignores chunks that arrive after stop', () => {
    const state = run([
      { type: 'ask', question: 'a' },
      { type: 'chunk', text: 'part' },
      { type: 'stop' },
      { type: 'chunk', text: ' late' },
    ])
    expect(state.rows[0]?.answer).toBe('part')
    expect(state.streaming).toBe(false)
  })

  it('drops the empty row on failure but keeps a partial answer', () => {
    const empty = run([
      { type: 'ask', question: 'a' },
      { type: 'fail', failure: 'limit' },
    ])
    expect(empty).toEqual({ rows: [], streaming: false, failure: 'limit' })
    const partial = run([
      { type: 'ask', question: 'a' },
      { type: 'chunk', text: 'half' },
      { type: 'fail', failure: 'unavailable' },
    ])
    expect(partial.rows).toHaveLength(1)
    expect(partial.failure).toBe('unavailable')
  })

  it('clears the failure and numbers rows on the next ask', () => {
    const state = run([
      { type: 'ask', question: 'a' },
      { type: 'chunk', text: 'x' },
      { type: 'fail', failure: 'unavailable' },
      { type: 'ask', question: 'b' },
    ])
    expect(state.failure).toBeNull()
    expect(state.rows.map((row) => row.id)).toEqual([1, 2])
  })
})

describe('failureForStatus', () => {
  it('maps the server answers to the states the sheet shows', () => {
    expect(failureForStatus(503)).toBe('disabled')
    expect(failureForStatus(429)).toBe('limit')
    for (const s of [401, 403, 404])
      expect(failureForStatus(s)).toBe('forbidden')
    expect(failureForStatus(502)).toBe('unavailable')
  })
})

describe('askHelper', () => {
  const input = (
    fetchImpl: typeof fetch,
    signal = new AbortController().signal,
  ) => {
    const chunks: string[] = []
    return {
      chunks,
      args: {
        lessonId: 'l 1',
        question: 'q',
        previewRole: null,
        signal,
        onChunk: (t: string) => chunks.push(t),
        fetchImpl,
      },
    }
  }

  it('posts to the encoded lesson path and reports chunks', async () => {
    let url = ''
    const { args, chunks } = input(async (u) => {
      url = String(u)
      return new Response('hello')
    })
    expect(await askHelper(args)).toBeNull()
    expect(url).toBe('/ai/lessons/l%201/ask')
    expect(chunks.join('')).toBe('hello')
  })

  it('returns the failure for an error status or a network error', async () => {
    const limited = input(async () => new Response('{}', { status: 429 }))
    expect(await askHelper(limited.args)).toBe('limit')
    const offline = input(async () => {
      throw new TypeError('offline')
    })
    expect(await askHelper(offline.args)).toBe('unavailable')
  })

  it('returns null when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const { args } = input(async () => {
      throw new DOMException('aborted', 'AbortError')
    }, controller.signal)
    expect(await askHelper(args)).toBeNull()
  })
})
