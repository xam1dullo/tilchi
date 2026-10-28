import { HttpException, Injectable } from '@nestjs/common'
import type { Actor } from '../groups/access'
import { canSeeGroup } from '../groups/access'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import { mintLivekitToken } from './livekit'

@Injectable()
export class MeetService {
  constructor(
    private readonly groups: GroupsService,
    private readonly lessons: LessonsService,
  ) {}

  async tokenForLesson(input: {
    lessonId: string
    actor: Actor
    apiKey: string
    apiSecret: string
  }) {
    const lesson = await this.lessons.get(input.lessonId)
    if (!lesson) throw new HttpException({ error: 'not_found' }, 404)
    const group = await this.groups.get(lesson.groupId)
    if (!group || !canSeeGroup(input.actor, group)) {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (lesson.status !== 'live') {
      throw new HttpException({ error: 'lesson_not_live' }, 409)
    }
    const meeting = await this.lessons.meetingForLesson(lesson.id)
    if (!meeting) throw new HttpException({ error: 'meeting_missing' }, 500)
    if (!input.apiKey || !input.apiSecret) {
      throw new HttpException(
        {
          error: 'livekit_unconfigured',
          note: 'Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET. The meet ticket stub cannot mint a room token.',
        },
        501,
      )
    }
    const issued = await mintLivekitToken({
      apiKey: input.apiKey,
      apiSecret: input.apiSecret,
      claims: {
        room: meeting.livekitRoom,
        identity: input.actor.userId,
        name: input.actor.name ?? input.actor.role,
        canPublish: true,
      },
    })
    return {
      token: issued.token,
      room: issued.room,
      expiresInSeconds: issued.expiresInSeconds,
    }
  }
}
