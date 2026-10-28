import { RoomServiceClient, TwirpError } from 'livekit-server-sdk'
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
})
