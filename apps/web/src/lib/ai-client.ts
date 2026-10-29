import { type AiFailure, failureForStatus } from './ai-sheet'
import { PREVIEW_HEADER } from './api'
import type { AppRole } from './nav'

type AskInput = {
  lessonId: string
  question: string
  previewRole: AppRole | null
  signal: AbortSignal
  onChunk: (text: string) => void
  fetchImpl?: typeof fetch
}

/** Browser-only. Streams the answer; returns the failure, or null on success or abort. */
export async function askHelper({
  lessonId,
  question,
  previewRole,
  signal,
  onChunk,
  fetchImpl = fetch,
}: AskInput): Promise<AiFailure | null> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (previewRole) headers[PREVIEW_HEADER] = previewRole
  try {
    const response = await fetchImpl(
      `/ai/lessons/${encodeURIComponent(lessonId)}/ask`,
      {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ question }),
        signal,
      },
    )
    if (!response.ok) return failureForStatus(response.status)
    if (!response.body) return 'unavailable'
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return null
      onChunk(value)
    }
  } catch {
    return signal.aborted ? null : 'unavailable'
  }
}
