import { tgLinkProps } from '@tilchi/content'
import type { Copy } from '../lib/i18n'
import type { FailureReason, LoginState } from '../lib/login-flow'
import { TelegramGlyph } from './telegram-glyph'

const failureCopy = {
  expired: 'expired',
  rejected: 'loginRejected',
  rate_limited: 'loginRateLimited',
  network: 'loginNetwork',
  unavailable: 'loginUnavailable',
} as const satisfies Record<FailureReason, keyof Copy>

type Props = {
  state: LoginState
  copy: Copy
  onBegin: () => void
}

function body({ state, copy, onBegin }: Props) {
  switch (state.kind) {
    case 'idle':
    case 'starting':
      return (
        <>
          <button
            className="btn btn-ink"
            type="button"
            disabled={state.kind === 'starting'}
            onClick={onBegin}
          >
            <TelegramGlyph />
            {copy.signInButton}
          </button>
          <p className="hint">{copy.signInHint}</p>
        </>
      )
    case 'verifying':
      return (
        <p className="handoff" role="status">
          {copy.loginVerifying}
        </p>
      )
    case 'waiting':
      return (
        <>
          <p className="handoff" role="status">
            {copy.waiting}
          </p>
          <div className="panel-actions">
            <a className="btn btn-outline" {...tgLinkProps(state.deepLink)}>
              <TelegramGlyph />
              {copy.loginOpenTelegram}
            </a>
          </div>
        </>
      )
    case 'confirmed':
      return (
        <p className="handoff" role="status">
          {copy.confirmed}
        </p>
      )
    case 'failed':
      return (
        <>
          <p className="handoff login-error" role="alert">
            {copy[failureCopy[state.reason]]}
          </p>
          <div className="panel-actions">
            <button className="btn btn-outline" type="button" onClick={onBegin}>
              {copy.retry}
            </button>
          </div>
        </>
      )
  }
}

/** Presentational: one screen per login state. The runner owns the logic. */
export function LoginPanel(props: Props) {
  const busy =
    props.state.kind === 'starting' || props.state.kind === 'verifying'
  return (
    <section className="sign-in" aria-busy={busy}>
      <h1>{props.copy.signInTitle}</h1>
      {body(props)}
    </section>
  )
}
