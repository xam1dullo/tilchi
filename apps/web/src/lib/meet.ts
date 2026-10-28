/**
 * Pure model of the classroom meeting page: what the user wants (mic, camera,
 * audio-only), what the room reports (status, peers, quality, sound), and the
 * views derived from both. Nothing here touches LiveKit, React or the DOM.
 */

export type Quality = 'excellent' | 'good' | 'poor' | 'lost' | 'unknown'

export type Device = 'mic' | 'camera'
export type Control = Device | 'audioOnly'

export type Failure =
  | 'forbidden'
  | 'notLive'
  | 'unconfigured'
  | 'unavailable'
  | 'dropped'

export type Status =
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'reconnecting' }
  | { kind: 'ended'; failure: Failure }

/** The part of a LiveKit track the page needs: bind it to an element. */
export type MediaHandle = {
  attach(element: HTMLMediaElement): unknown
  detach(element: HTMLMediaElement): unknown
}

export type Peer = {
  id: string
  name: string
  local: boolean
  speaking: boolean
  micOn: boolean
  /** Camera track to render, only while it is live. */
  video: MediaHandle | null
  /** Mic track to play. Never set for the local peer, so you do not hear yourself. */
  audio: MediaHandle | null
}

export type MeetState = {
  status: Status
  /** Local peer first, then remote peers in join order. */
  peers: Peer[]
  /** What the user wants. Applied to the room only while it is connected. */
  mic: boolean
  camera: boolean
  /** User choice. */
  audioOnly: boolean
  /** Set by a poor local connection; only the user clears it. */
  weakNetwork: boolean
  soundBlocked: boolean
  /** A device the browser or hardware refused. */
  blocked: Record<Device, boolean>
}

export type MeetEvent =
  | { type: 'status'; status: Status }
  | { type: 'peers'; peers: Peer[] }
  | { type: 'quality'; quality: Quality }
  | { type: 'sound'; playing: boolean }
  | { type: 'device-failed'; device: Device }
  | { type: 'toggle'; control: Control }

export type MediaPlan = { mic: boolean; camera: boolean }

export const initialMeet: MeetState = {
  status: { kind: 'connecting' },
  peers: [],
  mic: true,
  camera: true,
  audioOnly: false,
  weakNetwork: false,
  soundBlocked: false,
  blocked: { mic: false, camera: false },
}

function withDevice(
  state: MeetState,
  device: Device,
  on: boolean,
  blocked: boolean,
): MeetState {
  return device === 'mic'
    ? { ...state, mic: on, blocked: { ...state.blocked, mic: blocked } }
    : { ...state, camera: on, blocked: { ...state.blocked, camera: blocked } }
}

function toggle(state: MeetState, control: Control): MeetState {
  switch (control) {
    case 'mic':
      return withDevice(state, 'mic', !state.mic, false)
    case 'camera':
      return withDevice(state, 'camera', !state.camera, false)
    case 'audioOnly':
      return {
        ...state,
        audioOnly: !isAudioOnly(state),
        weakNetwork: false,
      }
  }
}

export function reduceMeet(state: MeetState, event: MeetEvent): MeetState {
  switch (event.type) {
    case 'status':
      return { ...state, status: event.status }
    case 'peers':
      return { ...state, peers: event.peers }
    case 'quality':
      // The room reports quality only when it changes, so a user override
      // holds until the connection drops again. Recovery never re-enables
      // video on its own: audio-only itself lifts the load and would flap.
      return event.quality === 'poor' ? { ...state, weakNetwork: true } : state
    case 'sound':
      return { ...state, soundBlocked: !event.playing }
    case 'device-failed':
      return withDevice(state, event.device, false, true)
    case 'toggle':
      return toggle(state, event.control)
  }
}

export function isAudioOnly(state: MeetState): boolean {
  return state.audioOnly || state.weakNetwork
}

/** What to publish: the camera is held back, not forgotten, in audio-only. */
export function mediaPlan(state: MeetState): MediaPlan {
  return { mic: state.mic, camera: state.camera && !isAudioOnly(state) }
}

/**
 * Peers as tiles. Audio-only hides every video so the room can stop sending
 * it; an ended meeting shows none, rather than frozen frames of a dead call.
 */
export function tilesOf(state: MeetState): Peer[] {
  if (state.status.kind === 'ended') return []
  return isAudioOnly(state)
    ? state.peers.map((peer) => ({ ...peer, video: null }))
    : state.peers
}

export type ControlsView = Record<Control, { on: boolean; disabled: boolean }>

/** How each toggle looks: the camera is parked, not removed, in audio-only. */
export function controlsOf(state: MeetState): ControlsView {
  const over = state.status.kind === 'ended'
  const audioOnly = isAudioOnly(state)
  return {
    mic: { on: state.mic, disabled: over },
    camera: { on: state.camera && !audioOnly, disabled: over || audioOnly },
    audioOnly: { on: audioOnly, disabled: over },
  }
}

/** Remount key for a fresh join after a failure. */
export function nextAttempt(attempt: number): number {
  return attempt + 1
}

export type NoticeKey =
  | 'meetConnecting'
  | 'meetReconnecting'
  | 'meetWeakNetwork'
  | 'meetMicBlocked'
  | 'meetCameraBlocked'
  | 'meetFailForbidden'
  | 'meetFailNotLive'
  | 'meetFailUnconfigured'
  | 'meetFailUnavailable'
  | 'meetFailDropped'

export type Notice = { key: NoticeKey; tone: 'status' | 'alert' }

const FAILURE_KEY: Record<Failure, NoticeKey> = {
  forbidden: 'meetFailForbidden',
  notLive: 'meetFailNotLive',
  unconfigured: 'meetFailUnconfigured',
  unavailable: 'meetFailUnavailable',
  dropped: 'meetFailDropped',
}

function statusNotice(status: Status): Notice | null {
  switch (status.kind) {
    case 'connecting':
      return { key: 'meetConnecting', tone: 'status' }
    case 'reconnecting':
      return { key: 'meetReconnecting', tone: 'status' }
    case 'ended':
      return { key: FAILURE_KEY[status.failure], tone: 'alert' }
    case 'connected':
      return null
  }
}

export function meetNotices(state: MeetState): Notice[] {
  const candidates: (Notice | null)[] = [
    statusNotice(state.status),
    state.weakNetwork ? { key: 'meetWeakNetwork', tone: 'status' } : null,
    state.blocked.mic ? { key: 'meetMicBlocked', tone: 'alert' } : null,
    state.blocked.camera ? { key: 'meetCameraBlocked', tone: 'alert' } : null,
  ]
  return candidates.filter((notice): notice is Notice => notice !== null)
}

/** The slice of an SDK track publication that decides whether media is live. */
export type PublicationLike = { isMuted: boolean; track?: MediaHandle }

/** The slice of an SDK participant the page reads. */
export type PeerRead = {
  identity: string
  name?: string
  isLocal: boolean
  isSpeaking: boolean
  camera?: PublicationLike
  mic?: PublicationLike
}

function liveTrack(publication?: PublicationLike): MediaHandle | null {
  return publication && !publication.isMuted && publication.track
    ? publication.track
    : null
}

export function peerFrom(read: PeerRead): Peer {
  return {
    id: read.identity,
    name: read.name || read.identity,
    local: read.isLocal,
    speaking: read.isSpeaking,
    micOn: read.mic !== undefined && !read.mic.isMuted,
    video: liveTrack(read.camera),
    audio: read.isLocal ? null : liveTrack(read.mic),
  }
}

const QUALITIES: readonly Quality[] = [
  'excellent',
  'good',
  'poor',
  'lost',
  'unknown',
]

/** Parse the SDK's quality string once, where it comes in. */
export function qualityOf(value: string): Quality {
  const known = QUALITIES.find((quality) => quality === value)
  return known === undefined ? 'unknown' : known
}

export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
  return letters.toUpperCase() || '?'
}
