import { RoomServiceClient, TrackType, TwirpError } from 'livekit-server-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomAdmin } from './room-admin'

describe('RoomAdmin', () => {
  beforeEach(() => {
    vi.stubEnv('LIVEKIT_API_KEY', 'devkey')
    vi.stubEnv('LIVEKIT_API_SECRET', 'devsecret')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('deletes exactly the ended lesson room', async () => {
    const remove = vi
      .spyOn(RoomServiceClient.prototype, 'deleteRoom')
      .mockResolvedValue()
    await new RoomAdmin().close('lesson-123')
    expect(remove).toHaveBeenCalledExactlyOnceWith('lesson-123')
  })

  it('allows retrying a room that is already gone', async () => {
    vi.spyOn(RoomServiceClient.prototype, 'deleteRoom').mockRejectedValue(
      new TwirpError('not_found', 'gone', 404, 'not_found'),
    )
    await expect(new RoomAdmin().close('lesson-123')).resolves.toBeUndefined()
  })

  it('reports a retryable failure when LiveKit is down', async () => {
    vi.spyOn(RoomServiceClient.prototype, 'deleteRoom').mockRejectedValue(
      new Error('offline'),
    )
    await expect(new RoomAdmin().close('lesson-123')).rejects.toMatchObject({
      status: 502,
    })
  })

  it('refuses to call LiveKit without credentials', async () => {
    vi.stubEnv('LIVEKIT_API_SECRET', '')
    const remove = vi.spyOn(RoomServiceClient.prototype, 'deleteRoom')
    await expect(new RoomAdmin().close('lesson-123')).rejects.toMatchObject({
      status: 501,
    })
    expect(remove).not.toHaveBeenCalled()
  })

  it('mutes only the unmuted audio tracks of one participant', async () => {
    vi.spyOn(RoomServiceClient.prototype, 'getParticipant').mockResolvedValue({
      tracks: [
        { sid: 'a1', type: TrackType.AUDIO, muted: false },
        { sid: 'a2', type: TrackType.AUDIO, muted: true },
        { sid: 'v1', type: TrackType.VIDEO, muted: false },
      ],
    } as never)
    const mute = vi
      .spyOn(RoomServiceClient.prototype, 'mutePublishedTrack')
      .mockResolvedValue({} as never)
    await new RoomAdmin().mute('lesson-1', 'u1')
    expect(mute).toHaveBeenCalledExactlyOnceWith('lesson-1', 'u1', 'a1', true)
  })

  it('reports a missing participant as 404 and a LiveKit outage as 502', async () => {
    const remove = vi.spyOn(RoomServiceClient.prototype, 'removeParticipant')
    remove.mockRejectedValueOnce(
      new TwirpError('not_found', 'gone', 404, 'not_found'),
    )
    await expect(new RoomAdmin().remove('r', 'u')).rejects.toMatchObject({
      status: 404,
    })
    remove.mockRejectedValueOnce(new Error('offline'))
    await expect(new RoomAdmin().remove('r', 'u')).rejects.toMatchObject({
      status: 502,
    })
  })
})
