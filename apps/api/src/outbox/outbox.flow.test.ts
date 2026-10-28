import { asc, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TelegramError } from '../bot/bot-api'
import { notifications, outbox, outboxDeliveries } from '../db/schema'
import { GroupsRepository } from '../groups/groups.repository'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import { LessonsRepository } from '../lessons/lessons.repository'
import { AttendanceRepository } from '../meet/attendance.repository'
import type { RoomAdmin } from '../meet/room-admin'
import { actorOf } from '../test/actors'
import { describeWithDatabase } from '../test/postgres'
import { SessionsRepository } from '../users/sessions.repository'
import { UsersRepository } from '../users/users.repository'
import { enqueue, OutboxRepository } from './outbox.repository'
import { NotificationsRepository } from './notifications.repository'
import { OutboxService } from './outbox.service'
import { OutboxWorker } from './outbox.worker'
import { MAX_ATTEMPTS } from './retry'
import type { TelegramSender } from './telegram-sender'

const at = (local: string) => new Date(`${local}+05:00`)
const LESSON_AT = at('2030-01-02T09:00:00')
// Before any reminder is due, so a drain at DAY handles the scheduled notice only.
const DAY = at('2029-12-31T12:00:00')
const NIGHT = at('2029-12-31T23:30:00')

describeWithDatabase('outbox', (current) => {
  let sent: Array<{ chat: string; text: string }>
  let failWith: (chat: string) => Error | null
  let rooms: { close: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    sent = []
    failWith = () => null
    rooms = { close: vi.fn().mockResolvedValue(undefined) }
    vi.stubEnv('PUBLIC_APP_URL', 'https://app.example')
    vi.stubEnv('ADMIN_CHAT_IDS', '1001,1002')
  })
  afterEach(() => vi.unstubAllEnvs())

  const rows = () =>
    current()
      .database.db.select()
      .from(outbox)
      .orderBy(asc(outbox.createdAt), asc(outbox.id))
  const scheduledRow = async () =>
    (await rows()).find((row) => row.event === 'lesson.scheduled')!
  const inboxRows = () => current().database.db.select().from(notifications)

  async function setup() {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessons = new LessonsRepository(db)
    const repo = new OutboxRepository(db)
    const telegram = {
      send: async (chat: string, text: string) => {
        const error = failWith(chat)
        if (error) throw error
        sent.push({ chat, text })
      },
    } as unknown as TelegramSender
    const service = new OutboxService(
      repo,
      new NotificationsRepository(db),
      lessons,
      rooms as unknown as RoomAdmin,
      telegram,
    )
    const worker = new OutboxWorker(repo, service)
    const teacher = await users.ensure({
      id: uuidv7(),
      role: 'teacher',
      name: 'T',
    })
    const ada = await users.upsertTelegram('111', 'Ada')
    const bob = await users.upsertTelegram('222', 'Bob')
    const group = await groups.create({
      name: 'A1',
      actor: actorOf('teacher', teacher.id),
    })
    await groups.putMember(group.id, ada.id)
    await groups.putMember(group.id, bob.id)
    const lesson = (await lessons.insert({
      id: uuidv7(),
      groupId: group.id,
      scheduledAt: LESSON_AT,
    }))!
    return {
      db,
      lessons,
      repo,
      service,
      worker,
      sessions: new SessionsRepository(db),
      group,
      lesson,
      teacher,
      ada,
      bob,
    }
  }

  describe('atomic enqueue', () => {
    it('writes the outbox rows with the domain row, and rolls both back together', async () => {
      const { db, lessons, group } = await setup()
      const id = uuidv7()
      await expect(
        db.db.transaction(async (tx) => {
          await lessons.insert(
            { id, groupId: group.id, scheduledAt: LESSON_AT },
            tx,
          )
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')
      expect(await lessons.get(id)).toBeNull()
      const keys = (await rows()).map((row) => row.idempotencyKey)
      expect(keys.some((key) => key.includes(id))).toBe(false)

      await db.db.transaction((tx) =>
        lessons.insert({ id, groupId: group.id, scheduledAt: LESSON_AT }, tx),
      )
      expect(
        (await rows()).filter((row) => row.idempotencyKey.includes(id)),
      ).not.toHaveLength(0)
    })

    it('stores one row for a repeated idempotency key', async () => {
      const { db } = await setup()
      const entry = {
        event: 'lesson.started' as const,
        payload: { lessonId: 'x' },
        idempotencyKey: 'dup',
      }
      expect(await enqueue(db.db, entry)).toBe(true)
      expect(await enqueue(db.db, entry)).toBe(false)
      expect(
        (await rows()).filter((row) => row.idempotencyKey === 'dup'),
      ).toHaveLength(1)
    })

    it('queues a notice per lesson transition and nothing for a repeat', async () => {
      const { lessons, lesson } = await setup()
      const events = async () => (await rows()).map((row) => row.event)
      expect((await events()).sort()).toEqual([
        'lesson.reminder',
        'lesson.reminder',
        'lesson.scheduled',
      ])
      await lessons.start(lesson.id, new Date())
      await lessons.start(lesson.id, new Date())
      await lessons.end(lesson.id, new Date())
      await lessons.end(lesson.id, new Date())
      const after = await events()
      expect(after.filter((e) => e === 'lesson.started')).toHaveLength(1)
      expect(after.filter((e) => e === 'meeting.close')).toHaveLength(1)
      const close = (await rows()).find((r) => r.event === 'meeting.close')
      expect(close?.payload).toEqual({
        lessonId: lesson.id,
        room: `lesson-${lesson.id}`,
      })
    })
  })

  describe('reminders', () => {
    const reminders = async () =>
      (await rows()).filter((row) => row.event === 'lesson.reminder')

    it('schedules T-24 h and T-15 min for the lesson time', async () => {
      await setup()
      expect((await reminders()).map((r) => r.availableAt)).toEqual([
        at('2030-01-01T09:00:00'),
        at('2030-01-02T08:45:00'),
      ])
    })

    it('retires the old reminders and queues new ones on reschedule', async () => {
      const { lessons, lesson, worker } = await setup()
      const moved = at('2030-01-03T10:00:00')
      await lessons.reschedule(lesson.id, moved)
      const all = await reminders()
      const pending = all.filter((r) => !r.sentAt)
      expect(all.filter((r) => r.lastError === 'superseded')).toHaveLength(2)
      expect(pending.map((r) => r.availableAt)).toEqual([
        at('2030-01-02T10:00:00'),
        at('2030-01-03T09:45:00'),
      ])
      // nothing is sent for the old time, even once it is due
      await worker.drainOnce(at('2030-01-02T09:00:00'))
      expect(sent.filter((m) => m.text.includes('Dars ertaga'))).toHaveLength(0)
    })

    it('moving a lesson away and back queues fresh reminders', async () => {
      const { lessons, lesson } = await setup()
      await lessons.reschedule(lesson.id, at('2030-01-03T10:00:00'))
      await lessons.reschedule(lesson.id, LESSON_AT)
      const pending = (await reminders()).filter((r) => !r.sentAt)
      expect(pending.map((r) => r.availableAt)).toEqual([
        at('2030-01-01T09:00:00'),
        at('2030-01-02T08:45:00'),
      ])
    })

    it('sends no reminder after a cancel', async () => {
      const { lessons, lesson, worker } = await setup()
      await lessons.cancel(lesson.id, new Date())
      await worker.drainOnce(at('2030-01-03T12:00:00'))
      expect(sent.some((m) => m.text.includes('Dars ertaga'))).toBe(false)
      expect(sent.some((m) => m.text.includes('bekor qilindi'))).toBe(true)
    })

    it('drops a reminder whose lesson is no longer scheduled for that time', async () => {
      const { db, lesson, worker } = await setup()
      await enqueue(db.db, {
        event: 'lesson.reminder',
        payload: {
          lessonId: lesson.id,
          groupId: lesson.groupId,
          scheduledAt: at('2030-01-09T09:00:00').toISOString(),
          lead: '15m',
        },
        idempotencyKey: 'stale',
      })
      await worker.drainOnce(at('2030-01-03T00:00:00'))
      expect(sent.some((m) => m.text.includes('09.01'))).toBe(false)
      const stale = (await rows()).find((r) => r.idempotencyKey === 'stale')
      expect(stale?.sentAt).not.toBeNull()
    })
  })

  describe('drain', () => {
    it('delivers to the web inbox and Telegram, learners only, without personal data', async () => {
      const { worker, ada, bob, teacher } = await setup()
      await worker.drainOnce(DAY)
      const inbox = await inboxRows()
      expect(inbox.map((n) => n.userId).sort()).toEqual([ada.id, bob.id].sort())
      expect(inbox.some((n) => n.userId === teacher.id)).toBe(false)
      expect(sent.map((m) => m.chat).sort()).toEqual(['111', '222'])
      const text = sent[0]?.text ?? ''
      expect(text).toContain('Yangi dars')
      expect(text).toContain('02.01 09:00')
      expect(text).toContain('https://app.example/app/groups/')
      expect(text).not.toMatch(/Ada|Bob|998/)
    })

    it('never sends twice when a row is redelivered', async () => {
      const { db, worker } = await setup()
      await worker.drainOnce(DAY)
      const first = sent.length
      expect(first).toBe(2)
      expect(await worker.drainOnce(DAY)).toBe(0)
      // the row is marked unsent again, as after a crash before commit
      await db.db
        .update(outbox)
        .set({ sentAt: null })
        .where(eq(outbox.event, 'lesson.scheduled'))
      await worker.drainOnce(DAY)
      expect(sent).toHaveLength(first)
      expect(await inboxRows()).toHaveLength(2)
    })

    it('two workers at once handle each row exactly once', async () => {
      const { db, worker, lesson } = await setup()
      for (let i = 0; i < 8; i += 1) {
        await enqueue(db.db, {
          event: 'lesson.cancelled',
          payload: {
            lessonId: lesson.id,
            groupId: lesson.groupId,
            scheduledAt: at(`2030-01-0${(i % 8) + 1}T09:00:00`).toISOString(),
          },
          idempotencyKey: `c${i}`,
        })
      }
      await Promise.all([worker.drainOnce(DAY), worker.drainOnce(DAY)])
      const cancelled = sent.filter((m) => m.text.includes('bekor qilindi'))
      // 8 notices x 2 learners, none doubled
      expect(cancelled).toHaveLength(16)
      expect(new Set(sent.map((m) => `${m.chat}|${m.text}`)).size).toBe(
        sent.length,
      )
    })

    it('tells only learners who have not joined that the lesson started', async () => {
      const { db, lessons, lesson, worker, ada } = await setup()
      await lessons.start(lesson.id, new Date())
      await new AttendanceRepository(db).record({
        lessonId: lesson.id,
        userId: ada.id,
        kind: 'join',
      })
      await worker.drainOnce(DAY)
      const started = sent.filter((m) => m.text.includes('Dars boshlandi'))
      expect(started.map((m) => m.chat)).toEqual(['222'])
    })
  })

  describe('quiet hours', () => {
    it('writes the inbox at night but holds the DM until 08:00 Tashkent', async () => {
      const { worker } = await setup()
      await worker.drainOnce(NIGHT)
      expect(await inboxRows()).toHaveLength(2)
      expect(sent).toHaveLength(0)
      const scheduled = await scheduledRow()
      expect(scheduled.sentAt).toBeNull()
      expect(scheduled.availableAt).toEqual(at('2030-01-01T08:00:00'))
      expect(scheduled.attempts).toBe(0)

      await worker.drainOnce(at('2030-01-01T07:59:00'))
      expect(sent).toHaveLength(0)
      await worker.drainOnce(at('2030-01-01T08:00:00'))
      expect(sent).toHaveLength(2)
      expect(await inboxRows()).toHaveLength(2)
    })

    it('lets an urgent DM through at night', async () => {
      const { lessons, lesson, worker } = await setup()
      await lessons.start(lesson.id, new Date())
      await worker.drainOnce(NIGHT)
      expect(sent.map((m) => m.text.split('\n')[0])).toEqual([
        'Dars boshlandi',
        'Dars boshlandi',
      ])
    })
  })

  describe('failures', () => {
    it('retries with exponential backoff and gives up after the maximum attempts', async () => {
      const { worker } = await setup()
      failWith = () => new Error('network down')
      let now = DAY
      let previousGap = 0
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        await worker.drainOnce(now)
        const row = await scheduledRow()
        expect(row?.attempts).toBe(attempt)
        expect(row?.lastError).toBe('network down')
        if (attempt < MAX_ATTEMPTS) {
          const gap = row!.availableAt.getTime() - now.getTime()
          expect(gap).toBeGreaterThanOrEqual(previousGap)
          previousGap = gap
          now = row!.availableAt
        } else {
          expect(row?.failedAt).not.toBeNull()
        }
      }
      sent.length = 0
      failWith = () => null
      await worker.drainOnce(new Date(now.getTime() + 24 * 3600 * 1000))
      expect(sent.some((m) => m.text.includes('Yangi dars'))).toBe(false)
    })

    it('after a partial failure only the missing chat is sent on retry', async () => {
      const { worker } = await setup()
      failWith = (chat) => (chat === '222' ? new Error('timeout') : null)
      await worker.drainOnce(DAY)
      expect(sent.map((m) => m.chat)).toEqual(['111'])
      failWith = () => null
      const row = await scheduledRow()
      await worker.drainOnce(row!.availableAt)
      expect(sent.map((m) => m.chat)).toEqual(['111', '222'])
      expect(
        await current().database.db.select().from(outboxDeliveries),
      ).toHaveLength(2)
    })

    it('waits as Telegram asks on 429 without counting an attempt', async () => {
      const { worker } = await setup()
      failWith = () => new TelegramError('limited', 429, 7)
      await worker.drainOnce(DAY)
      const row = await scheduledRow()
      expect(row?.attempts).toBe(0)
      expect(row?.availableAt).toEqual(new Date(DAY.getTime() + 7000))
    })

    it('skips a chat that blocked the bot instead of retrying it forever', async () => {
      const { worker } = await setup()
      failWith = (chat) =>
        chat === '111' ? new TelegramError('blocked', 403) : null
      await worker.drainOnce(DAY)
      const row = await scheduledRow()
      expect(row?.sentAt).not.toBeNull()
      expect(row?.attempts).toBe(0)
      expect(sent.map((m) => m.chat)).toEqual(['222'])
    })

    it('closes the LiveKit room from the outbox and retries a failed close', async () => {
      const { lessons, lesson, worker } = await setup()
      await lessons.start(lesson.id, new Date())
      await lessons.end(lesson.id, new Date())
      rooms.close.mockRejectedValueOnce(new Error('livekit down'))
      await worker.drainOnce(DAY)
      const closing = () =>
        rows().then((r) => r.find((row) => row.event === 'meeting.close')!)
      expect((await closing()).sentAt).toBeNull()
      expect((await closing()).attempts).toBe(1)
      await worker.drainOnce(new Date(DAY.getTime() + 60_000))
      expect((await closing()).sentAt).not.toBeNull()
      expect(rooms.close).toHaveBeenCalledTimes(2)
      expect(rooms.close).toHaveBeenLastCalledWith(`lesson-${lesson.id}`)
    })
  })

  describe('other events', () => {
    it('alerts each admin chat once for a completed registration, without the phone', async () => {
      const { db, worker } = await setup()
      await enqueue(db.db, {
        event: 'registration.completed',
        payload: {
          userId: 'u',
          telegramUserId: '99',
          name: 'Ada L',
          level: 'orta',
          source: null,
        },
        idempotencyKey: 'reg',
      })
      await worker.drainOnce(DAY)
      const alerts = sent.filter((m) => m.text.includes('New registration'))
      expect(alerts.map((m) => m.chat)).toEqual(['1001', '1002'])
      expect(alerts[0]?.text).toContain('Ada L')
      expect(alerts[0]?.text).toContain('tg://user?id=99')
      expect(alerts[0]?.text).not.toContain('998')
    })

    it('records a revoke-all in the inbox of that user only, with no second DM', async () => {
      const { worker, sessions, ada } = await setup()
      expect(
        await sessions.revokeAllForUser(ada.id, new Date(), { notify: true }),
      ).toEqual([])
      expect((await rows()).some((r) => r.event === 'sessions.revoked')).toBe(
        false,
      )
      await sessions.insert({
        userId: ada.id,
        tokenHash: 'h1',
        now: new Date(),
        idleExpiresAt: new Date(Date.now() + 1000),
        absoluteExpiresAt: new Date(Date.now() + 2000),
      })
      await sessions.revokeAllForUser(ada.id, new Date(), { notify: true })
      await worker.drainOnce(DAY)
      const mine = (await inboxRows()).filter(
        (n) => n.event === 'sessions.revoked',
      )
      expect(mine.map((n) => n.userId)).toEqual([ada.id])
      expect(sent.some((m) => m.text.includes('Seanslar'))).toBe(false)
    })
  })
})
