import { type Ref, useEffect, useReducer, useRef } from 'react'
import {
  type SignInState,
  canStart,
  claimOnce,
  pollClaim,
  reduce,
  sleep,
  startHandoff,
} from '../lib/handoff'
import { type Copy, messages } from '../lib/i18n'
import type { Locale } from '../lib/locale'
import { TelegramGlyph } from './telegram-glyph'

const idle: SignInState = { phase: 'idle' }

function noteFor(state: SignInState, copy: Copy): string | null {
  switch (state.phase) {
    case 'waiting':
      return copy.waiting
    case 'expired':
      return copy.expired
    case 'confirmed':
      return copy.confirmed
    case 'failed':
      return copy.signInError
    default:
      return null
  }
}

export function SignInView({
  state,
  copy,
  onStart,
  linkRef,
}: {
  state: SignInState
  copy: Copy
  onStart: () => void
  linkRef?: Ref<HTMLAnchorElement>
}) {
  const note = noteFor(state, copy)
  const retry = state.phase === 'expired' || state.phase === 'failed'
  return (
    <section className="sign-in">
      <h1>{copy.signInTitle}</h1>
      {state.phase === 'waiting' ? (
        <a
          className="btn btn-ink"
          href={state.deepLink}
          target="_blank"
          rel="noopener"
          ref={linkRef}
        >
          <TelegramGlyph />
          {copy.signInButton}
        </a>
      ) : (
        <button
          className="btn btn-ink"
          type="button"
          disabled={!canStart(state)}
          aria-busy={state.phase === 'starting'}
          onClick={onStart}
        >
          <TelegramGlyph />
          {retry ? copy.retry : copy.signInButton}
        </button>
      )}
      <p className="hint">{copy.signInHint}</p>
      <div aria-live="polite">
        {note ? (
          <p
            className="handoff"
            role={state.phase === 'failed' ? 'alert' : undefined}
          >
            {note}
          </p>
        ) : null}
      </div>
    </section>
  )
}

// The session cookie is HttpOnly and set by the API, so the page never sees a
// token: it starts a handoff, sends the user to the bot, and asks the API
// whether the bot confirmed.
export function SignIn({ locale }: { locale: Locale }) {
  const [state, dispatch] = useReducer(reduce, idle)
  const linkRef = useRef<HTMLAnchorElement>(null)

  // The button that was pressed turns into this link, which would drop keyboard
  // focus onto the page body.
  useEffect(() => {
    if (state.phase === 'waiting') linkRef.current?.focus()
  }, [state.phase])

  useEffect(() => {
    if (state.phase !== 'waiting') return
    let stop = false
    void pollClaim({ claim: claimOnce, sleep, cancelled: () => stop }).then(
      (result) => {
        if (result !== 'cancelled') {
          dispatch({ type: 'claimed', outcome: result })
        }
      },
    )
    return () => {
      stop = true
    }
  }, [state.phase])

  useEffect(() => {
    if (state.phase === 'confirmed') window.location.assign('/app')
  }, [state.phase])

  async function begin() {
    if (!canStart(state)) return
    dispatch({ type: 'start' })
    const deepLink = await startHandoff()
    dispatch({ type: 'started', deepLink })
    // Some browsers block a window opened after a request; the link stays on the page.
    if (deepLink) window.open(deepLink, '_blank', 'noopener')
  }

  return (
    <SignInView
      state={state}
      copy={messages(locale)}
      linkRef={linkRef}
      onStart={() => {
        void begin()
      }}
    />
  )
}
