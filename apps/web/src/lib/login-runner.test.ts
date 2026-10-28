import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import type { AuthResult } from './api'
import {
  MAX_POLL_STRIKES,
  MAX_WAIT_MS,
  POLL_INTERVAL_MS,
  type FailureReason,
  type LoginState,
} from './login-flow'
import { LoginRunner, type LoginDeps } from './login-runner'

const LINK = 'https://t.me/tilchiuz_bot?start=h1'
const started = (id = 'h-1'): AuthResult => ({
  ok: true,
  body: { handoffId: id, deepLink: LINK },
})
const no = (status: number | null): AuthResult => ({ ok: false, status })
const yes: AuthResult = { ok: true, body: { ok: true } }
const waiting = (strikes = 0): LoginState => ({
  kind: 'waiting',
  deepLink: LINK,
  strikes,
})
const failed = (reason: FailureReason): LoginState => ({
  kind: 'failed',
  reason,
})

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

type Mocked = { [K in keyof LoginDeps]: Mock<LoginDeps[K]> }

function setup() {
  const deps: Mocked = {
    start: vi.fn<LoginDeps['start']>(async () => started()),
    confirm: vi.fn<LoginDeps['confirm']>(async () => no(409)),
    miniApp: vi.fn<LoginDeps['miniApp']>(async () => yes),
    inMiniApp: vi.fn<LoginDeps['inMiniApp']>(() => false),
    readInitData: vi.fn<LoginDeps['readInitData']>(
      async () => 'query_id=1&hash=2',
    ),
    openLink: vi.fn<LoginDeps['openLink']>(),
    enterApp: vi.fn<LoginDeps['enterApp']>(async () => true),
  }
  const states: LoginState[] = []
  const runner = new LoginRunner(deps, (state) => states.push(state))
  return { deps, runner, states, last: () => states.at(-1) }
}

const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('deep link login', () => {
  it('starts a handoff, opens the Telegram link once and waits', async () => {
    const { deps, runner, states } = setup()
    runner.begin()
    await tick()
    expect(states).toEqual([{ kind: 'starting' }, waiting()])
    expect(deps.start).toHaveBeenCalledTimes(1)
    expect(deps.openLink).toHaveBeenCalledTimes(1)
    expect(deps.openLink).toHaveBeenCalledWith(LINK)
  })

  it('polls with the handoff id every 2 seconds, not faster', async () => {
    const { deps, runner } = setup()
    deps.start.mockResolvedValue(started('h-7'))
    runner.begin()
    await tick()
    expect(deps.confirm).not.toHaveBeenCalled()
    await tick(POLL_INTERVAL_MS - 1)
    expect(deps.confirm).not.toHaveBeenCalled()
    await tick(1)
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.confirm).toHaveBeenLastCalledWith(
      'h-7',
      expect.any(AbortSignal),
    )
    await tick(POLL_INTERVAL_MS)
    expect(deps.confirm).toHaveBeenCalledTimes(2)
    await tick(POLL_INTERVAL_MS * 3)
    expect(deps.confirm).toHaveBeenCalledTimes(5)
  })

  it('skips a tick while the last poll has no answer yet', async () => {
    const { deps, runner } = setup()
    const hung = deferred<AuthResult>()
    deps.confirm.mockReturnValueOnce(hung.promise)
    runner.begin()
    await tick(POLL_INTERVAL_MS * 4)
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    hung.resolve(no(409))
    await tick(POLL_INTERVAL_MS)
    expect(deps.confirm).toHaveBeenCalledTimes(2)
  })

  it('stops on success, enters the app once and polls no more', async () => {
    const { deps, runner, last } = setup()
    deps.confirm
      .mockResolvedValueOnce(no(409))
      .mockResolvedValueOnce(no(409))
      .mockResolvedValue(yes)
    runner.begin()
    await tick(POLL_INTERVAL_MS * 2)
    expect(last()?.kind).toBe('waiting')
    await tick(POLL_INTERVAL_MS)
    expect(last()).toEqual({ kind: 'confirmed' })
    expect(deps.enterApp).toHaveBeenCalledTimes(1)
    await tick(MAX_WAIT_MS)
    expect(deps.confirm).toHaveBeenCalledTimes(3)
    expect(last()).toEqual({ kind: 'confirmed' })
  })

  it.each([
    [410, 'expired'],
    [403, 'rejected'],
    [429, 'rate_limited'],
    [400, 'unavailable'],
  ] as const)('stops on a terminal %i answer: %s', async (status, reason) => {
    const { deps, runner, last } = setup()
    deps.confirm.mockResolvedValue(no(status))
    runner.begin()
    await tick(POLL_INTERVAL_MS)
    expect(last()).toEqual(failed(reason))
    await tick(MAX_WAIT_MS)
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.enterApp).not.toHaveBeenCalled()
  })

  it('gives up after 5 minutes with an expired login', async () => {
    const { deps, runner, last } = setup()
    runner.begin()
    await tick(MAX_WAIT_MS - 1)
    expect(last()?.kind).toBe('waiting')
    await tick(1)
    expect(last()).toEqual(failed('expired'))
    const calls = deps.confirm.mock.calls.length
    await tick(MAX_WAIT_MS)
    expect(deps.confirm).toHaveBeenCalledTimes(calls)
  })

  it('aborts the poll that is in flight when the login ends', async () => {
    const { deps, runner } = setup()
    deps.confirm.mockImplementation(() => new Promise<AuthResult>(() => {}))
    runner.begin()
    await tick(POLL_INTERVAL_MS)
    const signal = deps.confirm.mock.calls[0]?.[1]
    expect(signal?.aborted).toBe(false)
    await tick(MAX_WAIT_MS)
    expect(signal?.aborted).toBe(true)
  })

  it('survives answers that never came, but not three in a row', async () => {
    const { deps, runner, last } = setup()
    deps.confirm
      .mockResolvedValueOnce(no(null))
      .mockResolvedValueOnce(no(503))
      .mockResolvedValueOnce(no(409))
      .mockResolvedValue(no(null))
    runner.begin()
    await tick(POLL_INTERVAL_MS * 5)
    expect(last()).toEqual(waiting(2))
    await tick(POLL_INTERVAL_MS * (MAX_POLL_STRIKES - 2))
    expect(last()).toEqual(failed('network'))
  })

  it('names a 5xx streak unavailable, not a network problem', async () => {
    const { deps, runner, last } = setup()
    deps.confirm.mockResolvedValue(no(502))
    runner.begin()
    await tick(POLL_INTERVAL_MS * MAX_POLL_STRIKES)
    expect(last()).toEqual(failed('unavailable'))
  })

  it('ignores another tap while a login is running', async () => {
    const { deps, runner, states } = setup()
    runner.begin()
    runner.begin()
    await tick()
    runner.begin()
    await tick()
    expect(deps.start).toHaveBeenCalledTimes(1)
    expect(states).toEqual([{ kind: 'starting' }, waiting()])
  })

  it('stops everything on dispose', async () => {
    const { deps, runner, states } = setup()
    runner.begin()
    await tick(POLL_INTERVAL_MS)
    const signal = deps.confirm.mock.calls[0]?.[1]
    runner.dispose()
    expect(signal?.aborted).toBe(true)
    const seen = states.length
    await tick(MAX_WAIT_MS * 2)
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(states).toHaveLength(seen)
  })

  it('opens and polls nothing when disposed during the start request', async () => {
    const { deps, runner, states } = setup()
    const pending = deferred<AuthResult>()
    deps.start.mockReturnValue(pending.promise)
    runner.begin()
    runner.dispose()
    pending.resolve(started())
    await tick(POLL_INTERVAL_MS * 3)
    expect(deps.openLink).not.toHaveBeenCalled()
    expect(deps.confirm).not.toHaveBeenCalled()
    expect(states).toEqual([{ kind: 'starting' }])
  })

  it('retries with a fresh handoff and ignores answers of the old poll', async () => {
    const { deps, runner, last } = setup()
    deps.start
      .mockResolvedValueOnce(started('h-1'))
      .mockResolvedValueOnce(started('h-2'))
    const old = deferred<AuthResult>()
    deps.confirm.mockReturnValueOnce(old.promise)
    runner.begin()
    await tick(MAX_WAIT_MS)
    expect(last()).toEqual(failed('expired'))

    runner.begin()
    await tick()
    expect(last()).toEqual(waiting())
    old.resolve(no(null))
    await tick()
    expect(last()).toEqual(waiting())

    await tick(POLL_INTERVAL_MS)
    expect(deps.confirm).toHaveBeenLastCalledWith(
      'h-2',
      expect.any(AbortSignal),
    )
  })

  it('never lets the answer of an old poll confirm a new login', async () => {
    const { deps, runner, last } = setup()
    const old = deferred<AuthResult>()
    deps.confirm.mockReturnValueOnce(old.promise)
    runner.begin()
    await tick(MAX_WAIT_MS)
    runner.begin()
    await tick()
    old.resolve(yes)
    await tick()
    expect(last()).toEqual(waiting())
    expect(deps.enterApp).not.toHaveBeenCalled()
  })

  it.each([
    [no(429), 'rate_limited'],
    [no(null), 'network'],
    [no(500), 'unavailable'],
    [{ ok: true, body: { handoffId: 'h-1' } }, 'unavailable'],
    [
      {
        ok: true,
        body: { handoffId: 'h-1', deepLink: 'https://evil.example/' },
      },
      'unavailable',
    ],
  ] as const)(
    'fails when the start request is bad: %j',
    async (result, reason) => {
      const { deps, runner, states } = setup()
      deps.start.mockResolvedValue(result)
      runner.begin()
      await tick(POLL_INTERVAL_MS * 3)
      expect(states).toEqual([{ kind: 'starting' }, failed(reason)])
      expect(deps.openLink).not.toHaveBeenCalled()
      expect(deps.confirm).not.toHaveBeenCalled()
    },
  )
})

describe('after a confirmation', () => {
  it('fails when no session appeared', async () => {
    const { deps, runner, states } = setup()
    deps.confirm.mockResolvedValue(yes)
    deps.enterApp.mockResolvedValue(false)
    runner.begin()
    await tick(POLL_INTERVAL_MS)
    expect(states.map((state) => state.kind)).toEqual([
      'starting',
      'waiting',
      'confirmed',
      'failed',
    ])
    expect(states.at(-1)).toEqual(failed('unavailable'))
  })

  it('fails when entering the app throws', async () => {
    const { deps, runner, last } = setup()
    deps.confirm.mockResolvedValue(yes)
    deps.enterApp.mockRejectedValue(new Error('router'))
    runner.begin()
    await tick(POLL_INTERVAL_MS)
    expect(last()).toEqual(failed('unavailable'))
  })
})

describe('Mini App login', () => {
  function inside() {
    const rig = setup()
    rig.deps.inMiniApp.mockReturnValue(true)
    return rig
  }

  it('does nothing outside Telegram', async () => {
    const { deps, runner, states } = setup()
    runner.detect()
    await tick()
    expect(states).toEqual([])
    expect(deps.readInitData).not.toHaveBeenCalled()
  })

  it('posts the initData and enters the app, without a handoff', async () => {
    const { deps, runner, states } = inside()
    runner.detect()
    await tick()
    expect(states).toEqual([{ kind: 'verifying' }, { kind: 'confirmed' }])
    expect(deps.miniApp).toHaveBeenCalledWith('query_id=1&hash=2')
    expect(deps.enterApp).toHaveBeenCalledTimes(1)
    expect(deps.start).not.toHaveBeenCalled()
    expect(deps.openLink).not.toHaveBeenCalled()
  })

  it.each([
    [no(401), 'rejected'],
    [no(429), 'rate_limited'],
    [no(null), 'network'],
    [no(500), 'unavailable'],
  ] as const)('fails when the API answers %j', async (result, reason) => {
    const { deps, runner, last } = inside()
    deps.miniApp.mockResolvedValue(result)
    runner.detect()
    await tick()
    expect(last()).toEqual(failed(reason))
    expect(deps.enterApp).not.toHaveBeenCalled()
  })

  it('fails as unavailable when Telegram gives no initData', async () => {
    const { deps, runner, last } = inside()
    deps.readInitData.mockResolvedValue(null)
    runner.detect()
    await tick()
    expect(last()).toEqual(failed('unavailable'))
    expect(deps.miniApp).not.toHaveBeenCalled()
  })

  it('fails as a network problem when the Telegram script cannot load', async () => {
    const { deps, runner, last } = inside()
    deps.readInitData.mockRejectedValue(new Error('telegram_script_failed'))
    runner.detect()
    await tick()
    expect(last()).toEqual(failed('network'))
    expect(deps.miniApp).not.toHaveBeenCalled()
  })

  it('does not start while a login is already running', async () => {
    const { deps, runner } = inside()
    runner.begin()
    runner.detect()
    await tick()
    expect(deps.readInitData).not.toHaveBeenCalled()
  })

  it('falls back to the deep link flow when retried', async () => {
    const { deps, runner, last } = inside()
    deps.miniApp.mockResolvedValue(no(401))
    runner.detect()
    await tick()
    expect(last()).toEqual(failed('rejected'))
    runner.begin()
    await tick()
    expect(deps.start).toHaveBeenCalledTimes(1)
    expect(last()).toEqual(waiting())
  })

  it('posts nothing when disposed while the initData is being read', async () => {
    const { deps, runner, states } = inside()
    const reading = deferred<string | null>()
    deps.readInitData.mockReturnValue(reading.promise)
    runner.detect()
    runner.dispose()
    reading.resolve('query_id=1')
    await tick()
    expect(deps.miniApp).not.toHaveBeenCalled()
    expect(states).toEqual([{ kind: 'verifying' }])
  })
})
