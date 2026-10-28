import { expect, it } from 'vitest'
import { describeWithDatabase } from '../test/postgres'
import { SessionsRepository } from './sessions.repository'
import { UsersRepository } from './users.repository'

const DAY = 24 * 60 * 60 * 1000
const T0 = new Date('2026-11-01T09:00:00Z')
const at = (days: number) => new Date(T0.getTime() + days * DAY)

describeWithDatabase('SessionsRepository', (current) => {
  const sessions = () => new SessionsRepository(current().database)
  const open = async (hash = 'h1', idleDays = 30, absoluteDays = 90) => {
    const user = await new UsersRepository(current().database).upsertTelegram(
      '42',
      'Ada',
    )
    await sessions().insert({
      userId: user.id,
      tokenHash: hash,
      now: T0,
      idleExpiresAt: at(idleDays),
      absoluteExpiresAt: at(absoluteDays),
    })
    return user
  }

  it('finds a live session by hash and slides the idle expiry', async () => {
    const user = await open()
    const live = await sessions().touch('h1', at(10), 30 * DAY)
    expect(live).toEqual({
      userId: user.id,
      expiresAt: at(40),
      absoluteExpiresAt: at(90),
    })
  })

  it('never slides past the absolute cap', async () => {
    await open()
    await sessions().touch('h1', at(25), 30 * DAY)
    await sessions().touch('h1', at(50), 30 * DAY)
    const live = await sessions().touch('h1', at(75), 30 * DAY)
    expect(live?.expiresAt).toEqual(at(90))
  })

  it('ends at the idle expiry and at the absolute cap', async () => {
    await open()
    expect(await sessions().touch('h1', at(30), 30 * DAY)).toBeNull()
    expect(await sessions().touch('h1', at(31), 30 * DAY)).toBeNull()
  })

  it('ends at the absolute cap even when the idle window is still open', async () => {
    await open('h2', 100, 100)
    await sessions().touch('h2', at(99), 30 * DAY)
    expect(await sessions().touch('h2', at(100), 30 * DAY)).toBeNull()
  })

  it('does not know an unrevoked hash it never saw', async () => {
    await open()
    expect(await sessions().touch('other', at(1), 30 * DAY)).toBeNull()
  })

  it('stops a revoked session, and revoking twice is harmless', async () => {
    await open()
    await sessions().revoke('h1', at(1))
    await sessions().revoke('h1', at(2))
    expect(await sessions().touch('h1', at(3), 30 * DAY)).toBeNull()
  })

  it('refuses a second session with the same hash', async () => {
    const user = await open()
    await expect(
      sessions().insert({
        userId: user.id,
        tokenHash: 'h1',
        now: T0,
        idleExpiresAt: at(30),
        absoluteExpiresAt: at(90),
      }),
    ).rejects.toThrow()
  })

  it('refuses an idle expiry after the absolute one', async () => {
    await expect(open('h3', 91, 90)).rejects.toThrow()
  })
})
