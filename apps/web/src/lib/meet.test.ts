import { describe, expect, it } from 'vitest'
import {
  type MediaHandle,
  type MeetEvent,
  type MeetState,
  type Peer,
  initialMeet,
  initialsOf,
  isAudioOnly,
  mediaPlan,
  meetNotices,
  peerFrom,
  qualityOf,
  reduceMeet,
  tilesOf,
} from './meet'

const handle = (): MediaHandle => ({
  attach: () => undefined,
  detach: () => undefined,
})

const peer = (over: Partial<Peer> = {}): Peer => ({
  id: 'u1',
  name: 'Ada Lovelace',
  local: false,
  speaking: false,
  micOn: true,
  video: null,
  audio: null,
  ...over,
})

const run = (events: MeetEvent[], from: MeetState = initialMeet) =>
  events.reduce(reduceMeet, from)

const status = (kind: 'connected' | 'reconnecting'): MeetEvent => ({
  type: 'status',
  status: { kind },
})

describe('initial state', () => {
  it('joins connecting, wanting mic and camera, with video allowed', () => {
    expect(initialMeet.status).toEqual({ kind: 'connecting' })
    expect(initialMeet.peers).toEqual([])
    expect(isAudioOnly(initialMeet)).toBe(false)
    expect(mediaPlan(initialMeet)).toEqual({ mic: true, camera: true })
    expect(initialMeet.soundBlocked).toBe(false)
    expect(initialMeet.blocked).toEqual({ mic: false, camera: false })
  })
})

describe('reduceMeet status', () => {
  it('follows the connection from connecting to connected, reconnecting and ended', () => {
    expect(run([status('connected')]).status).toEqual({ kind: 'connected' })
    expect(run([status('connected'), status('reconnecting')]).status).toEqual({
      kind: 'reconnecting',
    })
    expect(
      run([
        status('connected'),
        { type: 'status', status: { kind: 'ended', failure: 'dropped' } },
      ]).status,
    ).toEqual({ kind: 'ended', failure: 'dropped' })
  })

  it('replaces the peer list with each snapshot', () => {
    const first = [peer({ id: 'a' }), peer({ id: 'b' })]
    const second = [peer({ id: 'b' })]
    const after = run([
      { type: 'peers', peers: first },
      { type: 'peers', peers: second },
    ])
    expect(after.peers).toEqual(second)
  })

  it('tracks whether the browser blocked remote audio', () => {
    expect(run([{ type: 'sound', playing: false }]).soundBlocked).toBe(true)
    expect(
      run([
        { type: 'sound', playing: false },
        { type: 'sound', playing: true },
      ]).soundBlocked,
    ).toBe(false)
  })
})

describe('reduceMeet controls', () => {
  it('toggles the mic and the camera independently', () => {
    const muted = run([{ type: 'toggle', control: 'mic' }])
    expect(muted.mic).toBe(false)
    expect(muted.camera).toBe(true)
    const dark = run([{ type: 'toggle', control: 'camera' }])
    expect(dark.camera).toBe(false)
    expect(dark.mic).toBe(true)
    const back = run([
      { type: 'toggle', control: 'mic' },
      { type: 'toggle', control: 'mic' },
    ])
    expect(back.mic).toBe(true)
  })

  it('switches a failed device off and flags only that device', () => {
    const mic = run([{ type: 'device-failed', device: 'mic' }])
    expect(mic.mic).toBe(false)
    expect(mic.camera).toBe(true)
    expect(mic.blocked).toEqual({ mic: true, camera: false })
    const camera = run([{ type: 'device-failed', device: 'camera' }])
    expect(camera.camera).toBe(false)
    expect(camera.mic).toBe(true)
    expect(camera.blocked).toEqual({ mic: false, camera: true })
  })

  it('clears a device flag when the user tries that device again', () => {
    const failed: MeetEvent[] = [
      { type: 'device-failed', device: 'mic' },
      { type: 'device-failed', device: 'camera' },
    ]
    const retriedMic = run([...failed, { type: 'toggle', control: 'mic' }])
    expect(retriedMic.mic).toBe(true)
    expect(retriedMic.blocked).toEqual({ mic: false, camera: true })
    const retriedCamera = run([
      ...failed,
      { type: 'toggle', control: 'camera' },
    ])
    expect(retriedCamera.camera).toBe(true)
    expect(retriedCamera.blocked).toEqual({ mic: true, camera: false })
  })
})

describe('audio-only', () => {
  it('is a user toggle that drops the camera and keeps the mic', () => {
    const on = run([{ type: 'toggle', control: 'audioOnly' }])
    expect(isAudioOnly(on)).toBe(true)
    expect(mediaPlan(on)).toEqual({ mic: true, camera: false })
    const off = reduceMeet(on, { type: 'toggle', control: 'audioOnly' })
    expect(isAudioOnly(off)).toBe(false)
    expect(mediaPlan(off)).toEqual({ mic: true, camera: true })
  })

  it('keeps a camera the user switched off, off, when audio-only ends', () => {
    const off = run([
      { type: 'toggle', control: 'camera' },
      { type: 'toggle', control: 'audioOnly' },
      { type: 'toggle', control: 'audioOnly' },
    ])
    expect(mediaPlan(off).camera).toBe(false)
  })

  it('engages by itself when the local connection turns poor', () => {
    const weak = run([{ type: 'quality', quality: 'poor' }])
    expect(isAudioOnly(weak)).toBe(true)
    expect(mediaPlan(weak).camera).toBe(false)
  })

  it.each(['excellent', 'good', 'lost', 'unknown'] as const)(
    'does not engage on %s quality',
    (quality) => {
      expect(isAudioOnly(run([{ type: 'quality', quality }]))).toBe(false)
    },
  )

  it('stays on after the quality recovers, so video does not flap', () => {
    const after = run([
      { type: 'quality', quality: 'poor' },
      { type: 'quality', quality: 'good' },
      { type: 'quality', quality: 'excellent' },
    ])
    expect(isAudioOnly(after)).toBe(true)
  })

  it('lets the user bring video back, and engages again on the next drop', () => {
    const overridden = run([
      { type: 'quality', quality: 'poor' },
      { type: 'toggle', control: 'audioOnly' },
    ])
    expect(isAudioOnly(overridden)).toBe(false)
    expect(mediaPlan(overridden).camera).toBe(true)
    const dropped = reduceMeet(overridden, { type: 'quality', quality: 'poor' })
    expect(isAudioOnly(dropped)).toBe(true)
  })

  it('clears both the user and the automatic cause with one toggle', () => {
    const both = run([
      { type: 'toggle', control: 'audioOnly' },
      { type: 'quality', quality: 'poor' },
      { type: 'toggle', control: 'audioOnly' },
    ])
    expect(both.audioOnly).toBe(false)
    expect(both.weakNetwork).toBe(false)
  })
})

describe('tilesOf', () => {
  it('passes peers through, in order, while video is allowed', () => {
    const camera = handle()
    const peers = [
      peer({ id: 'me', local: true, video: camera }),
      peer({ id: 'b' }),
    ]
    const state = run([{ type: 'peers', peers }])
    expect(tilesOf(state)).toEqual(peers)
    expect(tilesOf(state)[0]?.video).toBe(camera)
  })

  it('hides every video, and keeps audio, in audio-only', () => {
    const audio = handle()
    const peers = [
      peer({ id: 'a', video: handle(), audio }),
      peer({ id: 'b', video: handle() }),
    ]
    const state = run([
      { type: 'peers', peers },
      { type: 'toggle', control: 'audioOnly' },
    ])
    const tiles = tilesOf(state)
    expect(tiles.map((tile) => tile.video)).toEqual([null, null])
    expect(tiles[0]?.audio).toBe(audio)
    expect(tiles.map((tile) => tile.id)).toEqual(['a', 'b'])
  })
})

describe('meetNotices', () => {
  it('says nothing for a healthy connected room', () => {
    expect(meetNotices(run([status('connected')]))).toEqual([])
  })

  it('announces connecting and reconnecting as status updates', () => {
    expect(meetNotices(initialMeet)).toEqual([
      { key: 'meetConnecting', tone: 'status' },
    ])
    expect(meetNotices(run([status('reconnecting')]))).toEqual([
      { key: 'meetReconnecting', tone: 'status' },
    ])
  })

  it.each([
    ['forbidden', 'meetFailForbidden'],
    ['notLive', 'meetFailNotLive'],
    ['unconfigured', 'meetFailUnconfigured'],
    ['unavailable', 'meetFailUnavailable'],
    ['dropped', 'meetFailDropped'],
  ] as const)('raises an alert for the %s failure', (failure, key) => {
    const ended = run([{ type: 'status', status: { kind: 'ended', failure } }])
    expect(meetNotices(ended)).toEqual([{ key, tone: 'alert' }])
  })

  it('explains why video is off when the network is weak', () => {
    const weak = run([
      status('connected'),
      { type: 'quality', quality: 'poor' },
    ])
    expect(meetNotices(weak)).toEqual([
      { key: 'meetWeakNetwork', tone: 'status' },
    ])
  })

  it('does not blame the network when the user chose audio-only', () => {
    const chosen = run([
      status('connected'),
      { type: 'toggle', control: 'audioOnly' },
    ])
    expect(meetNotices(chosen)).toEqual([])
  })

  it('alerts about each blocked device, in mic then camera order', () => {
    const blocked = run([
      status('connected'),
      { type: 'device-failed', device: 'camera' },
      { type: 'device-failed', device: 'mic' },
    ])
    expect(meetNotices(blocked)).toEqual([
      { key: 'meetMicBlocked', tone: 'alert' },
      { key: 'meetCameraBlocked', tone: 'alert' },
    ])
    const onlyCamera = run([
      status('connected'),
      { type: 'device-failed', device: 'camera' },
    ])
    expect(meetNotices(onlyCamera)).toEqual([
      { key: 'meetCameraBlocked', tone: 'alert' },
    ])
  })

  it('lists the connection notice before the others', () => {
    const state = run([
      status('reconnecting'),
      { type: 'quality', quality: 'poor' },
      { type: 'device-failed', device: 'mic' },
    ])
    expect(meetNotices(state).map((notice) => notice.key)).toEqual([
      'meetReconnecting',
      'meetWeakNetwork',
      'meetMicBlocked',
    ])
  })
})

describe('peerFrom', () => {
  const live = (track: MediaHandle) => ({ isMuted: false, track })

  it('uses the display name, and the identity when there is none', () => {
    const base = { identity: 'u-7', isLocal: false, isSpeaking: false }
    expect(peerFrom({ ...base, name: 'Ada' }).name).toBe('Ada')
    expect(peerFrom({ ...base, name: '' }).name).toBe('u-7')
    expect(peerFrom(base).name).toBe('u-7')
    expect(peerFrom({ ...base, name: 'Ada' }).id).toBe('u-7')
  })

  it('carries the local and speaking flags', () => {
    const base = { identity: 'u', name: 'A' }
    const quiet = peerFrom({ ...base, isLocal: false, isSpeaking: false })
    expect(quiet.local).toBe(false)
    expect(quiet.speaking).toBe(false)
    const loud = peerFrom({ ...base, isLocal: true, isSpeaking: true })
    expect(loud.local).toBe(true)
    expect(loud.speaking).toBe(true)
  })

  it('reports the mic as on only when it is published and unmuted', () => {
    const base = { identity: 'u', isLocal: false, isSpeaking: false }
    expect(peerFrom(base).micOn).toBe(false)
    expect(peerFrom({ ...base, mic: { isMuted: true } }).micOn).toBe(false)
    expect(peerFrom({ ...base, mic: { isMuted: false } }).micOn).toBe(true)
  })

  it('shows video only for a live camera track', () => {
    const base = { identity: 'u', isLocal: false, isSpeaking: false }
    const track = handle()
    expect(peerFrom({ ...base, camera: live(track) }).video).toBe(track)
    expect(peerFrom({ ...base, camera: { isMuted: true, track } }).video).toBe(
      null,
    )
    expect(peerFrom({ ...base, camera: { isMuted: false } }).video).toBe(null)
    expect(peerFrom(base).video).toBe(null)
  })

  it('plays remote audio, and never the local mic back to its owner', () => {
    const track = handle()
    const base = { identity: 'u', isSpeaking: false, mic: live(track) }
    expect(peerFrom({ ...base, isLocal: false }).audio).toBe(track)
    expect(peerFrom({ ...base, isLocal: true }).audio).toBe(null)
    const muted = { ...base, isLocal: false, mic: { isMuted: true, track } }
    expect(peerFrom(muted).audio).toBe(null)
    expect(
      peerFrom({ identity: 'u', isLocal: false, isSpeaking: false }).audio,
    ).toBe(null)
  })
})

describe('qualityOf', () => {
  it.each(['excellent', 'good', 'poor', 'lost', 'unknown'] as const)(
    'keeps the %s value',
    (value) => {
      expect(qualityOf(value)).toBe(value)
    },
  )

  it('treats anything else as unknown', () => {
    expect(qualityOf('')).toBe('unknown')
    expect(qualityOf('GOOD')).toBe('unknown')
    expect(qualityOf('mediocre')).toBe('unknown')
  })
})

describe('initialsOf', () => {
  it('takes the first letter of up to two words, upper-cased', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL')
    expect(initialsOf('ada')).toBe('A')
    expect(initialsOf('  grace   brewster  hopper ')).toBe('GB')
  })

  it('keeps a whole character when the first one is outside the BMP', () => {
    expect(initialsOf('\u{1F600} smile')).toBe('\u{1F600}S')
  })

  it('falls back to a question mark for an empty name', () => {
    expect(initialsOf('')).toBe('?')
    expect(initialsOf('   ')).toBe('?')
  })
})
