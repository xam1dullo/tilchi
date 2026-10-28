import type { RoomOptions } from 'livekit-client'
import { type MeetEvent, peerFrom, qualityOf } from './meet'
import type { RoomHandle } from './meet-session'

/**
 * Opus audio is the SDK default. Simulcast publishes 720p, 360p and 180p;
 * adaptive stream and dynacast stop sending layers nobody watches, which is
 * what keeps a 12-person room within the VPS egress budget.
 */
export function roomOptions(): RoomOptions {
  return {
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: { simulcast: true },
  }
}

/**
 * The only module that touches livekit-client at runtime, and only through a
 * dynamic import, so the SDK is a separate chunk loaded on /app/meet alone.
 * It translates SDK events into MeetEvents and holds no decisions of its own;
 * keep it that way, it cannot be unit-tested without WebRTC.
 */
export async function openLiveKitRoom(
  emit: (event: MeetEvent) => void,
): Promise<RoomHandle> {
  const { Room, RoomEvent, ParticipantEvent, Track } = await import(
    'livekit-client'
  )
  const room = new Room(roomOptions())

  const syncPeers = () =>
    emit({
      type: 'peers',
      peers: [room.localParticipant, ...room.remoteParticipants.values()].map(
        (participant) =>
          peerFrom({
            identity: participant.identity,
            name: participant.name,
            isLocal: participant.isLocal,
            isSpeaking: participant.isSpeaking,
            camera: participant.getTrackPublication(Track.Source.Camera),
            mic: participant.getTrackPublication(Track.Source.Microphone),
          }),
      ),
    })

  const peerEvents = [
    RoomEvent.ParticipantConnected,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.ParticipantNameChanged,
    RoomEvent.ActiveSpeakersChanged,
    RoomEvent.TrackSubscribed,
    RoomEvent.TrackUnsubscribed,
    RoomEvent.TrackMuted,
    RoomEvent.TrackUnmuted,
    RoomEvent.LocalTrackPublished,
    RoomEvent.LocalTrackUnpublished,
  ]
  for (const event of peerEvents) room.on(event, syncPeers)

  room.on(RoomEvent.Reconnecting, () =>
    emit({ type: 'status', status: { kind: 'reconnecting' } }),
  )
  room.on(RoomEvent.Reconnected, () =>
    emit({ type: 'status', status: { kind: 'connected' } }),
  )
  room.on(RoomEvent.Disconnected, () =>
    emit({ type: 'status', status: { kind: 'ended', failure: 'dropped' } }),
  )
  room.on(RoomEvent.AudioPlaybackStatusChanged, () =>
    emit({ type: 'sound', playing: room.canPlaybackAudio }),
  )
  room.localParticipant.on(
    ParticipantEvent.ConnectionQualityChanged,
    (quality) => emit({ type: 'quality', quality: qualityOf(quality) }),
  )

  return {
    connect: async (url, token) => {
      await room.connect(url, token)
      syncPeers()
    },
    disconnect: () => {
      void room.disconnect()
    },
    setMic: async (on) => {
      await room.localParticipant.setMicrophoneEnabled(on)
    },
    setCamera: async (on) => {
      await room.localParticipant.setCameraEnabled(on)
    },
    startAudio: () => room.startAudio(),
  }
}
