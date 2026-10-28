import { createHash } from 'node:crypto'
import { asc } from 'drizzle-orm'
import { AccessToken } from 'livekit-server-sdk'
import { expect, it } from 'vitest'
import { attendanceEvents } from '../db/schema'
import { DEMO_LEARNER } from '../demo/policy'
import { seedClassroom } from '../demo/seed'
import { GroupsRepository } from '../groups/groups.repository'
import { GroupsService } from '../groups/groups.service'
import { LessonsRepository } from '../lessons/lessons.repository'
import { LessonsService } from '../lessons/lessons.service'
import { actorOf } from '../test/actors'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { AttendanceRepository } from './attendance.repository'
import { LivekitWebhook } from './livekit-webhook'

const KEY = 'devkey'
const SECRET = 'devsecret-devsecret-devsecret-0123'

async function signed(body: string, secret = SECRET) {
  const token = new AccessToken(KEY, secret)
  token.sha256 = createHash('sha256').update(body).digest('base64')
  return token.toJwt()
}

describeWithDatabase('LivekitWebhook', (current) => {
  const setup = async () => {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessons = new LessonsService(groups, new LessonsRepository(db))
    const { lesson } = await seedClassroom({ users, groups, lessons })
    await lessons.start({ lessonId: lesson.id, actor: actorOf('admin') })
    return {
      hook: new LivekitWebhook(new AttendanceRepository(db)),
      kinds: async () =>
        (
          await db.db
            .select({ kind: attendanceEvents.kind })
            .from(attendanceEvents)
            .orderBy(asc(attendanceEvents.at))
        ).map((row) => row.kind),
      body: (over: Record<string, unknown> = {}) =>
        JSON.stringify({
          event: 'participant_joined',
          id: 'EV_1',
          createdAt: 1793500000,
          room: { name: `lesson-${lesson.id}` },
          participant: { identity: DEMO_LEARNER.userId },
          ...over,
        }),
    }
  }
  const call = (
    hook: LivekitWebhook,
    rawBody: string,
    authorization: string | undefined,
  ) => hook.handle({ rawBody, authorization, apiKey: KEY, apiSecret: SECRET })

  it('records join once however often LiveKit redelivers it, then leave', async () => {
    const { hook, kinds, body } = await setup()
    const joined = body()
    const auth = await signed(joined)
    expect(await call(hook, joined, auth)).toEqual({ recorded: true })
    expect(await call(hook, joined, auth)).toEqual({ recorded: false })
    const left = body({ event: 'participant_left', id: 'EV_2' })
    expect(await call(hook, left, await signed(left))).toEqual({
      recorded: true,
    })
    expect(await kinds()).toEqual(['join', 'leave'])
  })

  it('rejects unsigned, wrongly signed and tampered bodies and stores nothing', async () => {
    const { hook, kinds, body } = await setup()
    const joined = body()
    await expect(call(hook, joined, undefined)).rejects.toMatchObject({
      status: 401,
    })
    await expect(
      call(hook, joined, await signed(joined, `${SECRET}x`)),
    ).rejects.toMatchObject({ status: 401 })
    await expect(
      call(hook, body({ id: 'EV_9' }), await signed(joined)),
    ).rejects.toMatchObject({ status: 401 })
    expect(await kinds()).toEqual([])
  })

  it('ignores other events, unknown rooms and identities we never minted', async () => {
    const { hook, kinds, body } = await setup()
    for (const raw of [
      body({ event: 'room_finished', id: 'EV_3' }),
      body({ room: { name: 'lesson-unknown' }, id: 'EV_4' }),
      body({ participant: { identity: 'not-a-user' }, id: 'EV_5' }),
    ]) {
      expect(await call(hook, raw, await signed(raw))).toEqual({
        recorded: false,
      })
    }
    expect(await kinds()).toEqual([])
  })
})
