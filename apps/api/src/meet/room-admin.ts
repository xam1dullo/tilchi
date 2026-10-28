import { HttpException, Injectable } from '@nestjs/common'
import { RoomServiceClient, TwirpError } from 'livekit-server-sdk'

@Injectable()
export class RoomAdmin {
  async close(room: string) {
    const key = process.env.LIVEKIT_API_KEY
    const secret = process.env.LIVEKIT_API_SECRET
    if (!key || !secret) {
      throw new HttpException({ error: 'livekit_unconfigured' }, 501)
    }
    const client = new RoomServiceClient(
      process.env.LIVEKIT_INTERNAL_URL ?? 'http://livekit:7880',
      key,
      secret,
    )
    try {
      await client.deleteRoom(room)
    } catch (error) {
      if (error instanceof TwirpError && error.code === 'not_found') return
      throw new HttpException({ error: 'meeting_close_failed' }, 502)
    }
  }
}
