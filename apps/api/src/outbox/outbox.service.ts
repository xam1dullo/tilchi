import { Inject, Injectable, Logger } from '@nestjs/common'
import { TelegramError, adminChatIds, publicAppUrl } from '../bot/bot-api'
import { LessonsRepository } from '../lessons/lessons.repository'
import { RoomAdmin } from '../meet/room-admin'
import {
  type LessonPayload,
  type OutboxEvent,
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
import { TelegramSender } from './telegram-sender'

const SENT: Outcome = { kind: 'sent' }

/**
 * Handles one claimed outbox row: resolves recipients, writes the web inbox
 * and sends Telegram messages. Re-running a row is safe: the inbox has a
 * unique (row, user) key and sent chats are recorded, so nothing goes out twice.
 * A throw means "retry later"; the repository applies the backoff.
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

  async handle(row: OutboxRow, now: Date): Promise<Outcome> {
    const event = row.event as OutboxEvent
    const payload = row.payload
    if (event === 'meeting.close') {
      await this.rooms.close(String(payload.room))
      return SENT
    }
    if (event === 'lesson.reminder' && (await this.stale(payload))) return SENT
    const message = renderMessage(event, payload)
    if (!message) throw new Error(`unknown outbox event ${row.event}`)
    const recipients = recipientsFor(event, await this.scope(event, payload))
    await this.writeInbox(row.id, event, message, recipients)
    return this.sendTelegram(row, message, recipients, now)
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
    message: Message,
    recipients: Member[],
    now: Date,
  ): Promise<Outcome> {
    const event = row.event as OutboxEvent
    const chats = channelsFor(event).telegram
      ? this.chats(event, recipients)
      : []
    if (chats.length === 0) return SENT
    // Quiet hours hold back the DM only; the web inbox is already written.
    const resume = isUrgent(event, row.payload) ? null : quietHoursEnd(now)
    if (resume) return { kind: 'defer', until: resume }
    const text = telegramText(message, publicAppUrl())
    const done = await this.outbox.deliveredChats(row.id)
    for (const chat of chats.filter((id) => !done.has(id))) {
      const wait = await this.sendOne(row.id, chat, text, now)
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
    now: Date,
  ): Promise<Outcome | null> {
    try {
      await this.telegram.send(chat, text)
    } catch (error) {
      if (!(error instanceof TelegramError)) throw error
      if (error.retryAfter) {
        // Rate-limited: wait as told, without counting a failed attempt.
        return {
          kind: 'defer',
          until: new Date(now.getTime() + error.retryAfter * 1000),
        }
      }
      // A blocked bot or unknown chat never succeeds; skip it for good.
      if (!error.permanent) throw error
      this.log.warn(`telegram ${error.status} for chat ${chat}; skipped`)
    }
    await this.outbox.markDelivered(outboxId, chat)
    return null
  }

  /** A reminder for a time the lesson no longer has, or a lesson no longer scheduled. */
  private async stale(payload: Record<string, unknown>) {
    const { lessonId, scheduledAt } = payload as Partial<LessonPayload>
    const lesson = lessonId ? await this.lessons.get(lessonId) : null
    return lesson?.status !== 'scheduled' || lesson.scheduledAt !== scheduledAt
  }

  private async scope(
    event: OutboxEvent,
    payload: Record<string, unknown>,
  ): Promise<Scope> {
    const { lessonId, groupId } = payload as Partial<LessonPayload>
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
        event === 'sessions.revoked'
          ? await this.outbox.user(String(payload.userId))
          : null,
    }
  }
}
