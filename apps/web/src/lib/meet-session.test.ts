import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import type { MeetEvent } from './meet'
import {
  type RoomHandle,
  type SessionDeps,
  attachMedia,
  createSession,
} from './meet-session'

/** Lets every pending promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function defer<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A room that records what the session asks of it. No WebRTC involved. */
function fakeRoom(over: Partial<RoomHandle> = {}) {
  const calls: string[] = []
  const room: RoomHandle = {
    connect: async (url, token) => {
      calls.push(`connect ${url} ${token}`)
    },
    disconnect: () => {
      calls.push('disconnect')
    },
    setMic: async (on) => {
      calls.push(`mic ${on}`)
    },
    setCamera: async (on) => {
      calls.push(`camera ${on}`)
    },
    startAudio: async () => {
      calls.push('startAudio')
    },
    ...over,
  }
  return { room, calls }
}

function harness(
  over: Partial<SessionDeps> = {},
  roomOver?: Partial<RoomHandle>,
) {
  const events: MeetEvent[] = []
  const { room, calls } = fakeRoom(roomOver)
  let fromRoom: (event: MeetEvent) => void = () => undefined
  let opened = 0
  const deps: SessionDeps = {
    fetchToken: async () => ({ token: 'jwt' }),
    openRoom: async (emit) => {
      opened += 1
      fromRoom = emit
      return room
    },
    signalUrl: () => 'wss://host/rtc',
    emit: (event) => {
      events.push(event)
    },
    ...over,
  }
  return {
    session: createSession(deps),
    events,
    calls,
    opened: () => opened,
    fromRoom: (event: MeetEvent) => fromRoom(event),
  }
}

const connected: MeetEvent = { type: 'status', status: { kind: 'connected' } }
const reconnecting: MeetEvent = {
  type: 'status',
  status: { kind: 'reconnecting' },
}
const ended = (failure: 'notLive' | 'unavailable'): MeetEvent => ({
  type: 'status',
  status: { kind: 'ended', failure },
})

describe('createSession joining', () => {
  it('connects with the issued token, then reports connected', async () => {
    const { session, calls, events } = harness()
    session.start()
    await flush()
    expect(calls).toEqual(['connect wss://host/rtc jwt'])
    expect(events).toEqual([connected])
  })

  it('ends with the mapped reason and opens no room when the token is refused', async () => {
    const { session, events, opened } = harness({
      fetchToken: async () => {
        throw new ApiError(409, { error: 'lesson_not_live' })
      },
    })
    session.start()
    await flush()
    expect(events).toEqual([ended('notLive')])
    expect(opened()).toBe(0)
  })

  it('ends as unavailable when the room cannot be opened', async () => {
    const { session, events } = harness({
      openRoom: async () => {
        throw new Error('chunk failed to load')
      },
    })
    session.start()
    await flush()
    expect(events).toEqual([ended('unavailable')])
  })

  it('ends as unavailable, never connected, when the connection fails', async () => {
    const { session, events, calls } = harness(
      {},
      {
        connect: async () => {
          throw new Error('websocket closed')
        },
      },
    )
    session.start()
    await flush()
    expect(events).toEqual([ended('unavailable')])
    expect(calls).toEqual([])
  })
})

describe('createSession stopping', () => {
  it('opens nothing and says nothing when stopped before the token arrives', async () => {
    const token = defer<{ token: string }>()
    const { session, events, opened } = harness({
      fetchToken: () => token.promise,
    })
    const stop = session.start()
    stop()
    token.resolve({ token: 'jwt' })
    await flush()
    expect(opened()).toBe(0)
    expect(events).toEqual([])
  })

  it('stays silent when stopped before a failing token request settles', async () => {
    const token = defer<{ token: string }>()
    const { session, events } = harness({ fetchToken: () => token.promise })
    const stop = session.start()
    stop()
    token.reject(new ApiError(404, { error: 'not_found' }))
    await flush()
    expect(events).toEqual([])
  })

  it('disconnects a room that finishes opening after the stop, without connecting it', async () => {
    const opening = defer<RoomHandle>()
    const { room, calls } = fakeRoom()
    const { session, events } = harness({ openRoom: () => opening.promise })
    const stop = session.start()
    await flush()
    stop()
    opening.resolve(room)
    await flush()
    expect(calls).toEqual(['disconnect'])
    expect(events).toEqual([])
  })

  it('disconnects a room that is still connecting and drops its late result', async () => {
    const connecting = defer<void>()
    const { session, events, calls } = harness(
      {},
      { connect: () => connecting.promise },
    )
    const stop = session.start()
    await flush()
    stop()
    expect(calls).toEqual(['disconnect'])
    connecting.resolve()
    await flush()
    expect(events).toEqual([])
  })

  it('drops room events after the stop but delivers them before', async () => {
    const { session, events, fromRoom } = harness()
    const stop = session.start()
    await flush()
    fromRoom({ type: 'quality', quality: 'poor' })
    stop()
    fromRoom({ type: 'quality', quality: 'good' })
    expect(events).toEqual([connected, { type: 'quality', quality: 'poor' }])
  })

  it('runs a fresh join after a stop, as a strict-mode remount does', async () => {
    const { session, events, calls, opened } = harness()
    const stopFirst = session.start()
    stopFirst()
    session.start()
    await flush()
    expect(opened()).toBe(1)
    expect(calls).toEqual(['connect wss://host/rtc jwt'])
    expect(events).toEqual([connected])
  })

  it('keeps the newer run when an older one is stopped late', async () => {
    const { session, calls } = harness()
    const stopFirst = session.start()
    session.start()
    await flush()
    stopFirst()
    session.plan({ mic: true, camera: false })
    await flush()
    expect(calls).toContain('mic true')
  })
})

describe('createSession media plan', () => {
  it('applies the plan once connected, mic before camera', async () => {
    const { session, calls } = harness()
    session.plan({ mic: true, camera: true })
    session.start()
    await flush()
    expect(calls).toEqual([
      'connect wss://host/rtc jwt',
      'mic true',
      'camera true',
    ])
  })

  it('applies a later change to a connected room', async () => {
    const { session, calls } = harness()
    session.plan({ mic: true, camera: true })
    session.start()
    await flush()
    session.plan({ mic: false, camera: true })
    await flush()
    expect(calls.slice(-2)).toEqual(['mic false', 'camera true'])
  })

  it('does not touch devices before connected or while reconnecting', async () => {
    const connecting = defer<void>()
    const { session, calls, fromRoom } = harness(
      {},
      { connect: () => connecting.promise },
    )
    session.start()
    session.plan({ mic: true, camera: true })
    await flush()
    expect(calls).toEqual([])
    connecting.resolve()
    await flush()
    expect(calls).toEqual(['mic true', 'camera true'])

    fromRoom(reconnecting)
    session.plan({ mic: false, camera: false })
    await flush()
    expect(calls).toEqual(['mic true', 'camera true'])
    fromRoom(connected)
    await flush()
    expect(calls).toEqual([
      'mic true',
      'camera true',
      'mic false',
      'camera false',
    ])
  })

  it('does nothing on a plan change when no run is active', async () => {
    const { session, calls } = harness()
    session.plan({ mic: true, camera: true })
    await flush()
    expect(calls).toEqual([])
  })

  it('does not apply a plan after the run is stopped', async () => {
    const { session, calls } = harness()
    const stop = session.start()
    await flush()
    stop()
    session.plan({ mic: true, camera: true })
    await flush()
    expect(calls).toEqual(['connect wss://host/rtc jwt', 'disconnect'])
  })

  it('reports a refused device, and still tries the other one', async () => {
    const { session, events, calls } = harness(
      {},
      {
        setMic: async () => {
          throw new Error('NotAllowedError')
        },
      },
    )
    session.plan({ mic: true, camera: true })
    session.start()
    await flush()
    expect(events).toEqual([
      connected,
      { type: 'device-failed', device: 'mic' },
    ])
    expect(calls).toContain('camera true')
  })

  it('reports a refused camera as the camera', async () => {
    const { session, events } = harness(
      {},
      {
        setCamera: async () => {
          throw new Error('NotFoundError')
        },
      },
    )
    session.plan({ mic: true, camera: true })
    session.start()
    await flush()
    expect(events).toEqual([
      connected,
      { type: 'device-failed', device: 'camera' },
    ])
  })

  it('stays quiet when switching a device off fails', async () => {
    const { session, events } = harness(
      {},
      {
        setMic: async () => {
          throw new Error('already gone')
        },
        setCamera: async () => {
          throw new Error('already gone')
        },
      },
    )
    session.plan({ mic: false, camera: false })
    session.start()
    await flush()
    expect(events).toEqual([connected])
  })

  it('runs one device change at a time, in order', async () => {
    const firstMic = defer<void>()
    let micCalls = 0
    const { session, calls } = harness(
      {},
      {
        setMic: async (on) => {
          micCalls += 1
          calls.push(`mic ${on}`)
          if (micCalls === 1) await firstMic.promise
        },
      },
    )
    session.plan({ mic: true, camera: true })
    session.start()
    await flush()
    session.plan({ mic: false, camera: true })
    await flush()
    expect(calls).toEqual(['connect wss://host/rtc jwt', 'mic true'])
    firstMic.resolve()
    await flush()
    expect(calls.slice(1)).toEqual([
      'mic true',
      'camera true',
      'mic false',
      'camera true',
    ])
  })
})

describe('createSession audio', () => {
  it('asks the open room to start audio playback', async () => {
    const { session, calls } = harness()
    session.start()
    await flush()
    session.startAudio()
    await flush()
    expect(calls).toContain('startAudio')
  })

  it('does nothing before a run starts or before its room opens', async () => {
    const token = defer<{ token: string }>()
    const { session, calls } = harness({ fetchToken: () => token.promise })
    session.startAudio()
    session.start()
    session.startAudio()
    await flush()
    expect(calls).toEqual([])
  })

  it('ignores a refusal: the room reports blocked playback itself', async () => {
    const { session } = harness(
      {},
      {
        startAudio: async () => {
          throw new Error('NotAllowedError')
        },
      },
    )
    session.start()
    await flush()
    session.startAudio()
    await flush()
  })
})

describe('attachMedia', () => {
  type El = { id: string }

  function recorder() {
    const calls: string[] = []
    return {
      calls,
      handle: {
        attach: (element: El) => calls.push(`attach ${element.id}`),
        detach: (element: El) => calls.push(`detach ${element.id}`),
      },
    }
  }

  it('attaches on call and detaches the same element on cleanup', () => {
    const { calls, handle } = recorder()
    const cleanup = attachMedia(handle, { id: 'video-1' })
    expect(calls).toEqual(['attach video-1'])
    cleanup()
    expect(calls).toEqual(['attach video-1', 'detach video-1'])
  })

  it('does nothing without a track or without an element', () => {
    const { calls, handle } = recorder()
    attachMedia(handle, null)()
    attachMedia<El>(null, { id: 'video-1' })()
    expect(calls).toEqual([])
  })
})
