import { HttpException, Inject, Injectable } from '@nestjs/common'
import { WebhookReceiver } from 'livekit-server-sdk'
import { AttendanceRepository } from './attendance.repository'

const KINDS = { participant_joined: 'join', participant_left: 'leave' } as const

/**
 * Verifies a LiveKit webhook (signed JWT carrying the body's sha256) and
 * stores participant join/leave as attendance. Unsigned or forged: 401.
 * Anything else LiveKit sends, or an identity we did not mint, is ignored.
 */
@Injectable()
export class LivekitWebhook {
  constructor(
    @Inject(AttendanceRepository)
    private readonly attendance: AttendanceRepository,
  ) {}

  async handle(input: {
    rawBody: string
    authorization: string | undefined
    apiKey: string
    apiSecret: string
  }): Promise<{ recorded: boolean }> {
    const event = await verify(input)
    const seen = participantEvent(event)
    if (!seen) return { recorded: false }
    const lessonId = await this.attendance.lessonIdForRoom(seen.room)
    if (!lessonId || !(await this.attendance.userExists(seen.userId))) {
      return { recorded: false }
    }
    return {
      recorded: await this.attendance.record({
        lessonId,
        userId: seen.userId,
        kind: seen.kind,
        at: eventTime(event.createdAt),
        livekitEventId: seen.id,
      }),
    }
  }
}

type LivekitEvent = Awaited<ReturnType<WebhookReceiver['receive']>>

function participantEvent(event: LivekitEvent) {
  const kind = KINDS[event.event as keyof typeof KINDS]
  const room = event.room?.name
  const userId = event.participant?.identity
  return kind && room && userId && event.id
    ? { kind, room, userId, id: event.id }
    : null
}

function eventTime(createdAt: bigint) {
  const seconds = Number(createdAt)
  return seconds > 0 ? new Date(seconds * 1000) : new Date()
}

async function verify(input: {
  rawBody: string
  authorization: string | undefined
  apiKey: string
  apiSecret: string
}) {
  if (!input.apiKey || !input.apiSecret) {
    throw new HttpException({ error: 'livekit_unconfigured' }, 501)
  }
  try {
    return await new WebhookReceiver(input.apiKey, input.apiSecret).receive(
      input.rawBody,
      input.authorization,
    )
  } catch {
    throw new HttpException({ error: 'invalid_signature' }, 401)
  }
}
