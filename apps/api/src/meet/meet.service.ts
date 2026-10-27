import { Inject, Injectable } from '@nestjs/common'
import type { SessionUser } from '../auth/auth.service'
import { teachesGroup } from '../groups/policy'
import { isRecord, parseUuid } from '../http/params'
import { type Result, apiError, fail, unwrap } from '../http/result'
import { LessonsRepository } from '../lessons/lessons.repository'
import {
  MEET_TOKEN_TTL_SECONDS,
  livekitCredentials,
  mintLiveKitToken,
} from './livekit-token'

function parseLessonId(body: unknown): Result<string> {
  if (!isRecord(body)) return fail(400, 'bad_lesson')
  return parseUuid(body.lessonId, 'bad_lesson')
}

// A token opens one room, the one stored for a lesson the caller may see and
// that is live now. Who may see it is the group rule: its teacher, an admin, or
// an active member. LiveKit is only checked last, so a caller who may not join
// learns nothing about how the server is configured.
@Injectable()
export class MeetService {
  constructor(
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository,
  ) {}

  async mint(actor: SessionUser, body: unknown, now = Date.now()) {
    const lessonId = unwrap(parseLessonId(body))
    const lesson = await this.lessons.findVisible(actor, lessonId)
    if (!lesson) throw apiError(404, 'not_found')
    if (lesson.status !== 'live') throw apiError(409, 'lesson_not_live')
    const credentials = livekitCredentials(process.env)
    if (!credentials) throw apiError(503, 'meet_disabled')
    return {
      token: mintLiveKitToken({
        credentials,
        identity: actor.userId,
        room: lesson.livekitRoom,
        name: actor.name,
        roomAdmin: teachesGroup(actor, lesson.teacherId),
        now,
      }),
      expiresInSeconds: MEET_TOKEN_TTL_SECONDS,
    }
  }
}
