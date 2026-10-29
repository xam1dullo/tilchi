import { useEffect, useReducer, useRef, useState } from 'react'
import { askHelper } from '../../lib/ai-client'
import {
  type AiFailure,
  type AiState,
  initialAi,
  reduceAi,
} from '../../lib/ai-sheet'
import { type AiCopy, aiCopy } from '../../lib/i18n/ai'
import type { Locale } from '../../lib/locale'
import type { AppRole } from '../../lib/nav'

const failureKey = {
  disabled: 'aiDisabled',
  limit: 'aiLimit',
  forbidden: 'aiForbidden',
  personal: 'aiPersonal',
  unavailable: 'aiUnavailable',
} as const satisfies Record<AiFailure, keyof AiCopy>

/** What the screen reader hears; the streaming text itself is not announced. */
export function announcement(
  state: AiState,
  stopped: boolean,
  copy: AiCopy,
): string {
  if (state.streaming) return copy.aiWorking
  if (state.failure) return copy[failureKey[state.failure]]
  if (stopped) return copy.aiStopped
  return state.rows.length > 0 ? copy.aiDone : ''
}

type Props = {
  lessonId: string
  previewRole: AppRole | null
  locale: Locale
}

/** Lazy chunk: the button, and the side sheet it opens. */
export default function AiHelper({ lessonId, previewRole, locale }: Props) {
  const copy = aiCopy[locale]
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    opener.current?.focus()
  }
  return (
    <>
      <button
        ref={opener}
        type="button"
        className="btn btn-outline"
        aria-expanded={open}
        aria-controls="ai-sheet"
        onClick={() => (open ? close() : setOpen(true))}
      >
        {copy.aiOpen}
      </button>
      {open ? (
        <AiSheet
          lessonId={lessonId}
          previewRole={previewRole}
          locale={locale}
          onClose={close}
        />
      ) : null}
    </>
  )
}

function AiSheet({
  lessonId,
  previewRole,
  locale,
  onClose,
}: Props & { onClose: () => void }) {
  const copy = aiCopy[locale]
  const [state, dispatch] = useReducer(reduceAi, initialAi)
  const [draft, setDraft] = useState('')
  const [stopped, setStopped] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLLIElement>(null)

  useEffect(() => {
    input.current?.focus()
    return () => abort.current?.abort()
  }, [])
  const lastAnswer = state.rows.at(-1)?.answer
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every new text
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [lastAnswer, state.rows.length])

  const send = () => {
    const question = draft.trim()
    if (state.streaming || question === '') return
    const controller = new AbortController()
    abort.current = controller
    setStopped(false)
    setDraft('')
    dispatch({ type: 'ask', question })
    void askHelper({
      lessonId,
      question,
      previewRole,
      signal: controller.signal,
      onChunk: (text) => dispatch({ type: 'chunk', text }),
    }).then((failure) => {
      if (controller.signal.aborted) return
      dispatch(failure ? { type: 'fail', failure } : { type: 'done' })
    })
  }
  const stop = () => {
    abort.current?.abort()
    setStopped(true)
    dispatch({ type: 'stop' })
    input.current?.focus()
  }

  return (
    <aside
      id="ai-sheet"
      className="ai-sheet"
      aria-labelledby="ai-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <header className="ai-head">
        <h3 id="ai-title">{copy.aiTitle}</h3>
        <button type="button" className="btn btn-text" onClick={onClose}>
          {copy.aiClose}
        </button>
      </header>
      <p className="hint">{copy.aiHint}</p>
      <ol className="ai-rows" aria-busy={state.streaming}>
        {state.rows.length === 0 ? (
          <li className="ai-empty">{copy.aiEmpty}</li>
        ) : null}
        {state.rows.map((row) => (
          <li key={row.id} className="ai-row">
            <p className="ai-label">{copy.aiQuestion}</p>
            <p className="ai-question">{row.question}</p>
            <p className="ai-label">{copy.aiAnswer}</p>
            <p className="ai-answer">{row.answer}</p>
          </li>
        ))}
        <li ref={end} aria-hidden="true" />
      </ol>
      <p className="sr-only" role="status">
        {announcement(state, stopped, copy)}
      </p>
      {state.failure ? (
        <p className="notice" data-tone="error">
          {copy[failureKey[state.failure]]}
        </p>
      ) : null}
      <form
        className="ai-form"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <label htmlFor="ai-input" className="ai-label">
          {copy.aiLabel}
        </label>
        <textarea
          id="ai-input"
          ref={input}
          rows={3}
          maxLength={600}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
        />
        {state.streaming ? (
          <button type="button" className="btn btn-outline" onClick={stop}>
            {copy.aiStop}
          </button>
        ) : (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={draft.trim() === ''}
          >
            {copy.aiAsk}
          </button>
        )}
      </form>
    </aside>
  )
}
