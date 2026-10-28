import { HttpException, Injectable } from '@nestjs/common'
import { RoomServiceClient, TrackType, TwirpError } from 'livekit-server-sdk'

function client() {
  const key = process.env.LIVEKIT_API_KEY
  const secret = process.env.LIVEKIT_API_SECRET
  if (!key || !secret) {
    throw new HttpException({ error: 'livekit_unconfigured' }, 501)
  }
  return new RoomServiceClient(
    process.env.LIVEKIT_INTERNAL_URL ?? 'http://livekit:7880',
    key,
    secret,
  )
}

const isNotFound = (error: unknown) =>
  error instanceof TwirpError && error.code === 'not_found'

@Injectable()
export class RoomAdmin {
  async close(room: string) {
    const rooms = client()
    try {
      await rooms.deleteRoom(room)
    } catch (error) {
      if (isNotFound(error)) return
      throw new HttpException({ error: 'meeting_close_failed' }, 502)
    }
  }

  /** Mutes every audio track the participant publishes. They can unmute themselves. */
  async mute(room: string, identity: string) {
    const rooms = client()
    try {
      const participant = await rooms.getParticipant(room, identity)
      for (const track of participant.tracks) {
        if (track.type === TrackType.AUDIO && !track.muted) {
          await rooms.mutePublishedTrack(room, identity, track.sid, true)
        }
      }
    } catch (error) {
      if (isNotFound(error)) {
        throw new HttpException({ error: 'participant_not_found' }, 404)
      }
      throw new HttpException({ error: 'participant_mute_failed' }, 502)
    }
  }

  async remove(room: string, identity: string) {
    const rooms = client()
    try {
      await rooms.removeParticipant(room, identity)
    } catch (error) {
      if (isNotFound(error)) {
        throw new HttpException({ error: 'participant_not_found' }, 404)
      }
      throw new HttpException({ error: 'participant_remove_failed' }, 502)
    }
  }
}
