import { Inject, Injectable, Logger } from '@nestjs/common'
import { TelegramError, adminChatIds, publicAppUrl } from '../bot/bot-api'
import type { Tx } from '../db/database'
import { LessonsRepository } from '../lessons/lessons.repository'
import { RoomAdmin } from '../meet/room-admin'
import {
  type LessonPayload,
  type OutboxEvent,
  type TestPayload,
  channelsFor,
  isUrgent,
} from './events'
import { type Message, renderMessage, telegramText } from './messages'
import { NotificationsRepository } from './notifications.repository'
import {
  type Outcome,
  OutboxRepository,
  type OutboxRow,
} from './outbox.repository'
import { quietHoursEnd } from './quiet-hours'
import { type Member, type Scope, recipientsFor } from './recipients'
import { TelegramCooldown, TelegramSender } from './telegram-sender'

const SENT: Outcome = { kind: 'sent' }
const HOUR_MS = 60 * 60 * 1000
/** A 24 h reminder that cannot go out before this long ahead is dropped. */
const REMINDER_24H_LATEST_MS = 12 * HOUR_MS

type Clock = () => Date

type LessonRead = Awaited<ReturnType<LessonsRepository['get']>>

/** A reminder for a time the lesson no longer has, or one quiet hours made too late. */
function reminderObsolete(
  lesson: LessonRead,
  payload: Partial<LessonPayload>,
  now: Date,
) {
  if (lesson?.status !== 'scheduled') return true
  if (lesson.scheduledAt !== payload.scheduledAt) return true
  return payload.lead === '24h' && tooLateFor24h(lesson.scheduledAt, now)
}

/** Quiet hours may push a 24 h reminder; past this point it would be misleading. */
function tooLateFor24h(scheduledAt: string, now: Date) {
  const sendAt = quietHoursEnd(now) ?? now
  return (
    sendAt.getTime() > new Date(scheduledAt).getTime() - REMINDER_24H_LATEST_MS
  )
}

/**
 * Handles one claimed outbox row: resolves recipients, writes the web inbox
 * and sends Telegram messages. Re-running a row is safe: the inbox has a
 * unique (row, user) key and sent chats are recorded, so a redelivery sends
 * nothing again; at most one duplicate is possible if the process dies between
 * a send and recording it. A throw means "retry later"; the repository applies
 * the backoff.
 */
@Injectable()
export class OutboxService {
  private readonly log = new Logger(OutboxService.name)

  constructor(
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository,
    @Inject(NotificationsRepository)
    private readonly inbox: NotificationsRepository,
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository,
    @Inject(RoomAdmin) private readonly rooms: RoomAdmin,
    @Inject(TelegramSender) private readonly telegram: TelegramSender,
  ) {}

  /**
   * `at` is when the drain picked the row up. `current()` is `at` plus the real
   * time spent since, so quiet hours and rate-limit waits are judged at the
   * moment of each send, not at the start of the drain. `tx` is the claim
   * transaction: the lesson is read in it with a share lock, so a reschedule
   * waits until this row is finished.
   */
  async handle(row: OutboxRow, at: Date, tx: Tx): Promise<Outcome> {
    const began = Date.now()
    const current: Clock = () => new Date(at.getTime() + Date.now() - began)
    const event = row.event as OutboxEvent
    const payload = row.payload
    if (event === 'meeting.close') {
      await this.rooms.close(String(payload.room))
      return SENT
    }
    if (await this.obsolete(event, payload, current(), tx)) return SENT
    const message = renderMessage(event, payload, current())
    if (!message) throw new Error(`unknown outbox event ${row.event}`)
    const recipients = recipientsFor(event, await this.scope(event, payload))
    await this.writeInbox(row.id, event, message, recipients)
    return this.sendTelegram(row, recipients, current)
  }

  /**
   * True when the row no longer applies: a reminder for a time the lesson no
   * longer has, a "started" notice for a lesson that is not live any more, or
   * a 24 h reminder that quiet hours would push too close to the lesson.
   */
  private async obsolete(
    event: OutboxEvent,
    payload: Record<string, unknown>,
    now: Date,
    tx: Tx,
  ) {
    if (event === 'test.reminder') {
      // Quiet hours may push a reminder past the deadline; then it is noise.
      return now.getTime() >= new Date(String(payload.deadline)).getTime()
    }
    if (event !== 'lesson.reminder' && event !== 'lesson.started') return false
    const id = (payload as Partial<LessonPayload>).lessonId
    const lesson = id ? await this.lessons.get(id, tx) : null
    return event === 'lesson.started'
      ? lesson?.status !== 'live'
      : reminderObsolete(lesson, payload as Partial<LessonPayload>, now)
  }

  private async writeInbox(
    outboxId: string,
    event: OutboxEvent,
    message: Message,
    recipients: Member[],
  ) {
    if (!channelsFor(event).web) return
    for (const user of recipients) {
      await this.inbox.add({ outboxId, userId: user.userId, event, ...message })
    }
  }

  private async sendTelegram(
    row: OutboxRow,
    recipients: Member[],
    current: Clock,
  ): Promise<Outcome> {
    const event = row.event as OutboxEvent
    const chats = channelsFor(event).telegram
      ? this.chats(event, recipients)
      : []
    const done = await this.outbox.deliveredChats(row.id)
    for (const chat of chats.filter((id) => !done.has(id))) {
      // Quiet hours are checked right before each send, with the clock then.
      const resume = isUrgent(event, row.payload)
        ? null
        : quietHoursEnd(current())
      if (resume) return { kind: 'defer', until: resume }
      const message = renderMessage(event, row.payload, current())
      const text = telegramText(message as Message, publicAppUrl())
      const wait = await this.sendOne(row.id, chat, text, current)
      if (wait) return wait
    }
    return SENT
  }

  private chats(event: OutboxEvent, recipients: Member[]) {
    const ids =
      event === 'registration.completed'
        ? adminChatIds()
        : recipients.flatMap((m) => (m.telegramId ? [m.telegramId] : []))
    return [...new Set(ids)]
  }

  /** Sends to one chat and records it; returns a deferral when Telegram rate-limits. */
  private async sendOne(
    outboxId: string,
    chat: string,
    text: string,
    current: Clock,
  ): Promise<Outcome | null> {
    try {
      await this.telegram.send(chat, text)
    } catch (error) {
      const until = (seconds: number) =>
        new Date(current().getTime() + seconds * 1000)
      // Another row hit the limit: wait out the shared cooldown, no failed attempt.
      if (error instanceof TelegramCooldown) {
        return { kind: 'defer', until: until(error.retryAfter) }
      }
      if (!(error instanceof TelegramError)) throw error
      if (error.retryAfter) {
        // Rate-limited: wait as told; counts as an attempt so retries are capped.
        return {
          kind: 'defer',
          until: until(error.retryAfter),
          attempt: true,
        }
      }
      // A blocked bot or unknown chat never succeeds; skip it for good.
      if (!error.permanent) throw error
      this.log.warn(`telegram ${error.status} for chat ${chat}; skipped`)
    }
    await this.outbox.markDelivered(outboxId, chat)
    return null
  }

  private async scope(
    event: OutboxEvent,
    payload: Record<string, unknown>,
  ): Promise<Scope> {
    const { lessonId, groupId } = payload as Partial<LessonPayload>
    const { assignmentId } = payload as Partial<TestPayload>
    const group = groupId
      ? await this.outbox.groupScope(groupId)
      : { teacherId: null, members: [] }
    return {
      ...group,
      joinedIds:
        event === 'lesson.started' && lessonId
          ? await this.outbox.joinedIds(lessonId)
          : [],
      subject:
        event === 'sessions.revoked' ||
        event === 'test.graded' ||
        (event === 'test.assigned' && payload.userId)
          ? await this.outbox.user(String(payload.userId))
          : null,
      attempts: assignmentId
        ? await this.outbox.attemptsOf(assignmentId)
        : undefined,
    }
  }
}
