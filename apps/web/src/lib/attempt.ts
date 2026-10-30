import { ApiError } from './api'
import type { AttemptStatus } from './assignments'
import type { Copy } from './i18n'

type ErrorKey = keyof Copy

/** One row of `GET /api/me/assignments`. */
export type MyAssignment = {
  attemptId: string
  assignmentId: string
  groupId: string
  groupName: string
  title: string
  deadline: string
  status: AttemptStatus
  score: number | null
  submittedAt: string | null
}

export type AttemptQuestion = {
  id: string
  type: 'single' | 'multi' | 'speaking'
  prompt: string
  options: { id: string; text: string }[] | null
  /** Only once graded. */
  result?: { points: number; max: number }
}

/** `GET /api/attempts/:id` as its learner sees it: never the answer key. */
export type AttemptRecord = {
  id: string
  title: string
  status: AttemptStatus
  deadline: string
  submittedAt: string | null
  score: number | null
  maxScore: number
  feedback: string | null
  answers: Record<string, string[]>
  recorded: string[]
  questions: AttemptQuestion[]
}

/** Question id to the picked option ids. */
export type Draft = Record<string, string[]>

// Mirrors apps/api/src/storage/object-storage.ts; the server decides.
export const AUDIO_TYPES = ['audio/webm', 'audio/mp4'] as const
export type AudioType = (typeof AUDIO_TYPES)[number]
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
export const MAX_RECORDING_MS = 3 * 60 * 1000

/** Single replaces the pick, multi toggles it. */
export function pick(draft: Draft, q: AttemptQuestion, optionId: string) {
  const current = draft[q.id] ?? []
  const next =
    q.type === 'single'
      ? [optionId]
      : current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
  return { ...draft, [q.id]: next }
}

/** Choice answers only: the server refuses speaking ids, recordings go by upload. */
export function answersBody(questions: AttemptQuestion[], draft: Draft) {
  const answers: Draft = {}
  for (const q of questions) {
    const picked = draft[q.id]
    if (q.type !== 'speaking' && picked?.length) answers[q.id] = [...picked]
  }
  return { answers }
}

/**
 * Every choice answered and every speaking question recorded, with no
 * recorder still starting, recording or uploading: presign already points the
 * server at the new take, so submitting mid-upload would lose the answer.
 */
export function canSubmit(
  questions: AttemptQuestion[],
  draft: Draft,
  recorded: readonly string[],
  active: readonly string[] = [],
) {
  return (
    active.length === 0 &&
    questions.every((q) =>
      q.type === 'speaking'
        ? recorded.includes(q.id)
        : (draft[q.id]?.length ?? 0) > 0,
    )
  )
}

/** Adds or removes an id; the same array back when nothing changed. */
export function markActive(ids: string[], id: string, on: boolean) {
  if (on === ids.includes(id)) return ids
  return on ? [...ids, id] : ids.filter((x) => x !== id)
}

/**
 * One recording at a time per recorder. `begin` refuses while a take is in
 * flight; `cancel` (unmount) makes every earlier take stale, so a late
 * getUserMedia or a superseded recorder never records or uploads.
 */
export function recorderSlots() {
  let current = 0
  let busy = false
  return {
    begin(): number | null {
      if (busy) return null
      busy = true
      current += 1
      return current
    },
    isCurrent: (id: number) => id === current,
    end(id: number) {
      if (id === current) busy = false
    },
    cancel() {
      current += 1
      busy = false
    },
  }
}

export function pickMime(
  isTypeSupported: (type: string) => boolean,
): AudioType | null {
  return AUDIO_TYPES.find((type) => isTypeSupported(type)) ?? null
}

type Recorder = { isTypeSupported?: (type: string) => boolean }

/** The browser can record a type the server accepts. */
export function micSupported(
  nav: { mediaDevices?: { getUserMedia?: unknown } } | undefined,
  recorder: Recorder | undefined,
) {
  return Boolean(
    nav?.mediaDevices?.getUserMedia &&
      recorder?.isTypeSupported &&
      pickMime(recorder.isTypeSupported),
  )
}

const ERRORS: Record<string, ErrorKey> = {
  already_submitted: 'attemptAlreadySubmitted',
  deadline_passed: 'attemptDeadlinePassed',
  invalid_answers: 'attemptInvalid',
  not_found: 'attemptNotFound',
  audio_too_large: 'recordTooLarge',
  unsupported_audio_type: 'recordUnsupported',
  upload_failed: 'recordUploadFailed',
}

/** Copy key for a failed attempt request; unknown codes are generic. */
export function attemptError(error: unknown): ErrorKey {
  if (error instanceof ApiError && error.status === 404)
    return 'attemptNotFound'
  if (error instanceof ApiError && error.status === 403)
    return 'attemptForbidden'
  return error instanceof Error && Object.hasOwn(ERRORS, error.message)
    ? ERRORS[error.message]
    : 'courseUnavailable'
}

export type Upload = {
  url: string
  method: 'PUT'
  headers: Record<string, string>
}

type PresignBody = { questionId: string; contentType: AudioType; size: number }

/**
 * Presign, then PUT the blob with exactly the headers the url was signed for.
 * `onSending` runs before the presign request leaves: the server repoints at
 * the new take when it presigns, even if its answer is then lost, so from that
 * moment the old take can no longer be trusted. Local refusals never reach it.
 */
export async function uploadAudio(
  fetchImpl: typeof fetch,
  presign: (body: PresignBody) => Promise<Upload>,
  questionId: string,
  blob: Blob,
  contentType: AudioType,
  onSending: () => void,
) {
  if (blob.size < 1 || blob.size > MAX_AUDIO_BYTES)
    throw new Error('audio_too_large')
  onSending()
  const upload = await presign({ questionId, contentType, size: blob.size })
  const response = await fetchImpl(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: blob,
  }).catch(() => null)
  if (!response?.ok) throw new Error('upload_failed')
}

/** Leaves the Telegram WebView for the real browser; false: let the link open. */
export function openOutside(host: Pick<Window, 'Telegram'>, url: string) {
  const app = host.Telegram?.WebApp
  if (!app?.openLink) return false
  app.openLink(url)
  return true
}
