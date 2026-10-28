import type { AuthResult } from './api'
import {
  MAX_WAIT_MS,
  POLL_INTERVAL_MS,
  failureReason,
  initialLogin,
  loginReducer,
  parseStart,
  pollEvent,
  type LoginEvent,
  type LoginState,
} from './login-flow'

/** Every async dep resolves, never rejects, except readInitData and enterApp. */
export type LoginDeps = {
  start: () => Promise<AuthResult>
  confirm: (handoffId: string, signal: AbortSignal) => Promise<AuthResult>
  miniApp: (initData: string) => Promise<AuthResult>
  inMiniApp: () => boolean
  readInitData: () => Promise<string | null>
  openLink: (url: string) => void
  /** Reload the session and show the app. false: no session appeared. */
  enterApp: () => Promise<boolean>
}

/** Runs one login at a time and reports every state change to onState. */
export class LoginRunner {
  private state: LoginState = initialLogin
  private disposed = false
  private stopPolling = () => {}

  constructor(
    private readonly deps: LoginDeps,
    private readonly onState: (state: LoginState) => void,
  ) {}

  /** The sign-in or retry button. Ignored while a login is running. */
  begin() {
    if (this.send({ type: 'begin' })) void this.startDeepLink()
  }

  /** On mount: inside Telegram the Mini App proof replaces the handoff. */
  detect() {
    if (this.deps.inMiniApp() && this.send({ type: 'verify' })) {
      void this.verifyMiniApp()
    }
  }

  dispose() {
    this.disposed = true
    this.stopPolling()
  }

  /** false when the event changed nothing or the runner is disposed. */
  private send(event: LoginEvent) {
    if (this.disposed) return false
    const next = loginReducer(this.state, event)
    if (next === this.state) return false
    this.state = next
    if (next.kind !== 'waiting') this.stopPolling()
    this.onState(next)
    if (next.kind === 'confirmed') void this.finish()
    return true
  }

  private async startDeepLink() {
    const read = parseStart(await this.deps.start())
    if (!read.ok) {
      this.send({ type: 'failed', reason: read.reason })
      return
    }
    if (!this.send({ type: 'started', deepLink: read.deepLink })) return
    this.deps.openLink(read.deepLink)
    this.poll(read.handoffId)
  }

  /** One poll at a time. Aborting drops the answer of a poll that is in flight. */
  private poll(handoffId: string) {
    const controller = new AbortController()
    let busy = false
    const interval = setInterval(async () => {
      if (busy) return
      busy = true
      const result = await this.deps.confirm(handoffId, controller.signal)
      busy = false
      if (!controller.signal.aborted) this.send(pollEvent(result))
    }, POLL_INTERVAL_MS)
    const deadline = setTimeout(() => {
      this.send({ type: 'deadline' })
    }, MAX_WAIT_MS)
    this.stopPolling = () => {
      controller.abort()
      clearInterval(interval)
      clearTimeout(deadline)
    }
  }

  private async verifyMiniApp() {
    let initData: string | null
    try {
      initData = await this.deps.readInitData()
    } catch {
      this.send({ type: 'failed', reason: 'network' })
      return
    }
    if (this.disposed) return
    if (initData === null) {
      this.send({ type: 'failed', reason: 'unavailable' })
      return
    }
    const result = await this.deps.miniApp(initData)
    this.send(
      result.ok
        ? { type: 'confirmed' }
        : { type: 'failed', reason: failureReason(result.status) },
    )
  }

  private async finish() {
    const entered = await this.deps.enterApp().catch(() => false)
    if (!entered) this.send({ type: 'failed', reason: 'unavailable' })
  }
}
