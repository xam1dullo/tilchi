import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import {
  type AttemptQuestion,
  MAX_AUDIO_BYTES,
  answersBody,
  attemptError,
  canSubmit,
  markActive,
  micSupported,
  openOutside,
  pick,
  pickMime,
  recorderSlots,
  uploadAudio,
} from './attempt'

const options = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
  { id: 'c', text: 'C' },
]
const single: AttemptQuestion = {
  id: 's',
  type: 'single',
  prompt: 'S',
  options,
}
const multi: AttemptQuestion = { id: 'm', type: 'multi', prompt: 'M', options }
const speaking: AttemptQuestion = {
  id: 'v',
  type: 'speaking',
  prompt: 'V',
  options: null,
}
const questions = [single, multi, speaking]

describe('pick', () => {
  it('replaces a single answer and toggles a multi one', () => {
    let draft = pick({}, single, 'a')
    draft = pick(draft, single, 'b')
    expect(draft.s).toEqual(['b'])
    draft = pick(draft, multi, 'a')
    draft = pick(draft, multi, 'c')
    draft = pick(draft, multi, 'a')
    expect(draft.m).toEqual(['c'])
  })
})

describe('answersBody', () => {
  it('sends choice answers only, never speaking ids or blanks', () => {
    expect(
      answersBody(questions, { s: ['b'], m: [], v: ['x'], gone: ['a'] }),
    ).toEqual({ answers: { s: ['b'] } })
    expect(answersBody(questions, { s: ['a'], m: ['c', 'a'] })).toEqual({
      answers: { s: ['a'], m: ['c', 'a'] },
    })
  })
})

describe('canSubmit', () => {
  const full = { s: ['a'], m: ['b'] }
  it('needs every choice answered and every speaking question recorded', () => {
    expect(canSubmit(questions, full, ['v'])).toBe(true)
    expect(canSubmit(questions, full, [])).toBe(false)
    expect(canSubmit(questions, { s: ['a'], m: [] }, ['v'])).toBe(false)
    expect(canSubmit(questions, { m: ['b'] }, ['v'])).toBe(false)
  })

  it('holds while any recorder is starting, recording or uploading', () => {
    expect(canSubmit(questions, full, ['v'], ['v'])).toBe(false)
    expect(canSubmit(questions, full, ['v'], [])).toBe(true)
  })
})

describe('pickMime', () => {
  it('prefers webm, falls back to mp4, else nothing', () => {
    expect(pickMime(() => true)).toBe('audio/webm')
    expect(pickMime((t) => t === 'audio/mp4')).toBe('audio/mp4')
    expect(pickMime((t) => t === 'audio/ogg')).toBeNull()
  })
})

describe('micSupported', () => {
  const nav = { mediaDevices: { getUserMedia: () => undefined } }
  const recorder = { isTypeSupported: (t: string) => t === 'audio/mp4' }
  it('needs getUserMedia and a recorder that writes an accepted type', () => {
    expect(micSupported(nav, recorder)).toBe(true)
    expect(micSupported({}, recorder)).toBe(false)
    expect(micSupported(undefined, recorder)).toBe(false)
    expect(micSupported(nav, undefined)).toBe(false)
    expect(micSupported(nav, { isTypeSupported: () => false })).toBe(false)
  })
})

describe('attemptError', () => {
  it('maps server codes, 403 and 404, and keeps unknown ones generic', () => {
    expect(
      attemptError(new ApiError(409, { error: 'already_submitted' })),
    ).toBe('attemptAlreadySubmitted')
    expect(attemptError(new ApiError(409, { error: 'deadline_passed' }))).toBe(
      'attemptDeadlinePassed',
    )
    expect(attemptError(new ApiError(400, { error: 'invalid_answers' }))).toBe(
      'attemptInvalid',
    )
    expect(attemptError(new ApiError(404, { error: 'not_found' }))).toBe(
      'attemptNotFound',
    )
    expect(attemptError(new ApiError(403, { error: 'forbidden' }))).toBe(
      'attemptForbidden',
    )
    expect(attemptError(new Error('upload_failed'))).toBe('recordUploadFailed')
    expect(attemptError(new Error('audio_too_large'))).toBe('recordTooLarge')
    expect(attemptError(new Error('toString'))).toBe('courseUnavailable')
    expect(attemptError('boom')).toBe('courseUnavailable')
  })
})

describe('uploadAudio', () => {
  const upload = {
    url: 'https://s3.test/put',
    method: 'PUT' as const,
    headers: { 'Content-Type': 'audio/webm', 'Content-Length': '3' },
  }

  it('presigns with the exact type and size, then PUTs the blob with the signed headers', async () => {
    const blob = new Blob(['abc'], { type: 'audio/webm;codecs=opus' })
    const presign = vi.fn(async () => upload)
    const put = vi.fn(async () => new Response(null, { status: 200 }))
    const sending = vi.fn()
    await uploadAudio(put, presign, 'q1', blob, 'audio/webm', sending)
    expect(sending).toHaveBeenCalledTimes(1)
    expect(presign).toHaveBeenCalledWith({
      questionId: 'q1',
      contentType: 'audio/webm',
      size: 3,
    })
    expect(put).toHaveBeenCalledWith(upload.url, {
      method: 'PUT',
      headers: upload.headers,
      body: blob,
    })
  })

  it('refuses an empty or oversized take before asking the server', async () => {
    const presign = vi.fn(async () => upload)
    const put = vi.fn()
    const sending = vi.fn()
    const big = new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)])
    await expect(
      uploadAudio(put, presign, 'q', big, 'audio/mp4', sending),
    ).rejects.toThrow('audio_too_large')
    await expect(
      uploadAudio(put, presign, 'q', new Blob([]), 'audio/mp4', sending),
    ).rejects.toThrow('audio_too_large')
    // Never reached the server: the old take is still the one it holds.
    expect(sending).not.toHaveBeenCalled()
    expect(presign).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('fails when storage refuses or the network drops', async () => {
    const blob = new Blob(['x'])
    const presign = async () => upload
    const refused = async () => new Response(null, { status: 403 })
    const offline = async () => {
      throw new TypeError('network')
    }
    await expect(
      uploadAudio(refused, presign, 'q', blob, 'audio/webm', () => {}),
    ).rejects.toThrow('upload_failed')
    await expect(
      uploadAudio(offline, presign, 'q', blob, 'audio/webm', () => {}),
    ).rejects.toThrow('upload_failed')
  })

  it('drops the old take before presigning, even if the presign answer is lost', async () => {
    const put = vi.fn()
    const order: string[] = []
    const refusal = new ApiError(409, { error: 'deadline_passed' })
    await expect(
      uploadAudio(
        put,
        async () => {
          order.push('presign')
          throw refusal
        },
        'q',
        new Blob(['x']),
        'audio/webm',
        () => order.push('sending'),
      ),
    ).rejects.toBe(refusal)
    expect(order).toEqual(['sending', 'presign'])
    expect(put).not.toHaveBeenCalled()
  })
})

describe('openOutside', () => {
  it('uses Telegram openLink when inside the WebView, else lets the link open', () => {
    const openLink = vi.fn()
    expect(openOutside({ Telegram: { WebApp: { openLink } } }, 'u')).toBe(true)
    expect(openLink).toHaveBeenCalledWith('u')
    expect(openOutside({ Telegram: { WebApp: {} } }, 'u')).toBe(false)
    expect(openOutside({}, 'u')).toBe(false)
  })
})

describe('markActive', () => {
  it('adds and removes once, returning the same array when unchanged', () => {
    const none: string[] = []
    const one = markActive(none, 'v', true)
    expect(one).toEqual(['v'])
    expect(markActive(one, 'v', true)).toBe(one)
    expect(markActive(none, 'v', false)).toBe(none)
    expect(markActive(one, 'v', false)).toEqual([])
  })
})

describe('recorderSlots', () => {
  it('refuses a second start while a take is in flight (double tap)', () => {
    const slots = recorderSlots()
    const first = slots.begin()
    expect(first).not.toBeNull()
    expect(slots.begin()).toBeNull()
    slots.end(first as number)
    expect(slots.begin()).not.toBeNull()
  })

  it('makes a cancelled take stale so it never records or uploads', () => {
    const slots = recorderSlots()
    const old = slots.begin() as number
    slots.cancel()
    expect(slots.isCurrent(old)).toBe(false)
    const next = slots.begin() as number
    expect(slots.isCurrent(next)).toBe(true)
    slots.end(old)
    expect(slots.begin()).toBeNull()
  })
})
