import type { Device, Failure, MediaPlan, MeetEvent } from './meet'
import { tokenFailure } from './meet-api'

/** A LiveKit room as the page sees it. The adapter in meet-livekit.ts implements it. */
export type RoomHandle = {
  connect(url: string, token: string): Promise<void>
  disconnect(): void
  setMic(on: boolean): Promise<void>
  setCamera(on: boolean): Promise<void>
  startAudio(): Promise<void>
}

export type SessionDeps = {
  fetchToken(): Promise<{ token: string }>
  /** Loads the SDK and builds a room that reports through `emit`. */
  openRoom(emit: (event: MeetEvent) => void): Promise<RoomHandle>
  signalUrl(): string
  emit(event: MeetEvent): void
}

export type Session = {
  /** Joins the room. Returns the cleanup that leaves it. Safe to call again after a stop. */
  start(): () => void
  /** Records what to publish and applies it whenever the room is connected. */
  plan(next: MediaPlan): void
  /** Must run from a click: browsers only unlock sound for a user gesture. */
  startAudio(): void
}

/** One join attempt. Everything it does is dropped once `alive` is false. */
type Run = {
  alive: boolean
  room: RoomHandle | null
  live: boolean
  queue: Promise<void>
  emit(event: MeetEvent): void
}

const ended = (failure: Failure): MeetEvent => ({
  type: 'status',
  status: { kind: 'ended', failure },
})

async function attempt(
  operation: () => Promise<void>,
  on: boolean,
  device: Device,
  report: (event: MeetEvent) => void,
) {
  try {
    await operation()
  } catch {
    // Turning a device off cannot be refused in a way the user can act on.
    if (on) report({ type: 'device-failed', device })
  }
}

async function join(deps: SessionDeps, run: Run) {
  let token: string
  try {
    token = (await deps.fetchToken()).token
  } catch (error) {
    run.emit(ended(tokenFailure(error)))
    return
  }
  if (!run.alive) return
  try {
    const room = await deps.openRoom(run.emit)
    run.room = room
    if (!run.alive) {
      room.disconnect()
      return
    }
    await room.connect(deps.signalUrl(), token)
  } catch {
    run.emit(ended('unavailable'))
    return
  }
  run.emit({ type: 'status', status: { kind: 'connected' } })
}

export function createSession(deps: SessionDeps): Session {
  let desired: MediaPlan | null = null
  let current: Run | null = null

  function flush(run: Run) {
    run.queue = run.queue.then(() => apply(run))
  }

  // Devices change one at a time, always toward the latest plan, so a burst
  // of toggles cannot start overlapping getUserMedia calls.
  async function apply(run: Run) {
    const { room } = run
    const plan = desired
    if (!run.alive || !run.live || room === null || plan === null) return
    await attempt(() => room.setMic(plan.mic), plan.mic, 'mic', run.emit)
    await attempt(
      () => room.setCamera(plan.camera),
      plan.camera,
      'camera',
      run.emit,
    )
  }

  function open(): Run {
    const run: Run = {
      alive: true,
      room: null,
      live: false,
      queue: Promise.resolve(),
      emit: (event) => {
        if (!run.alive) return
        deps.emit(event)
        if (event.type === 'status') {
          run.live = event.status.kind === 'connected'
          flush(run)
        }
      },
    }
    return run
  }

  return {
    start() {
      const run = open()
      current = run
      void join(deps, run)
      return () => {
        run.alive = false
        run.room?.disconnect()
        if (current === run) current = null
      }
    },
    plan(next) {
      desired = next
      if (current !== null) flush(current)
    },
    startAudio() {
      // A refusal needs no handling here: the room reports blocked playback
      // itself, and the page keeps offering the button.
      void current?.room?.startAudio().catch(() => undefined)
    },
  }
}

const noop = () => undefined

/** Binds a LiveKit track to a media element, and returns the unbind. */
export function attachMedia<E>(
  handle: { attach(element: E): unknown; detach(element: E): unknown } | null,
  element: E | null,
): () => void {
  if (handle === null || element === null) return noop
  handle.attach(element)
  return () => {
    handle.detach(element)
  }
}
