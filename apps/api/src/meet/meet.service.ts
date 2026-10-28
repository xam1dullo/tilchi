import { HttpException, Inject, Injectable } from '@nestjs/common'
import type { Actor } from '../groups/access'
import { canManageGroup, canSeeGroup } from '../groups/access'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import { AttendanceRepository } from './attendance.repository'
import { mintLivekitToken } from './livekit'
import { RoomAdmin } from './room-admin'

@Injectable()
export class MeetService {
  constructor(
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(LessonsService) private readonly lessons: LessonsService,
    @Inject(AttendanceRepository)
    private readonly attendance: AttendanceRepository,
    @Inject(RoomAdmin) private readonly rooms: RoomAdmin,
  ) {}

  /** Mute or remove one participant; the Lesson keeps running. */
  async moderate(input: {
    lessonId: string
    actor: Actor
    targetUserId: string
    action: 'mute' | 'remove'
  }) {
    const { meeting, group } = await this.liveMeeting(
      input.lessonId,
      input.actor,
    )
    if (!canManageGroup(input.actor, group)) {
      throw new HttpException({ error: 'forbidden' }, 403)
    }
    if (input.action === 'mute') {
      await this.rooms.mute(meeting.livekitRoom, input.targetUserId)
    } else {
      await this.rooms.remove(meeting.livekitRoom, input.targetUserId)
    }
    return { ok: true }
  }

  async tokenForLesson(input: {
    lessonId: string
    actor: Actor
    apiKey: string
    apiSecret: string
  }) {
    const { lesson, meeting } = await this.liveMeeting(
      input.lessonId,
      input.actor,
    )
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
    await this.attendance.record({
      lessonId: lesson.id,
      userId: input.actor.userId,
      kind: 'token',
    })
    return {
      token: issued.token,
      room: issued.room,
      expiresInSeconds: issued.expiresInSeconds,
    }
  }

  /** The live Lesson and its Meeting, for someone who can see the Group. */
  private async liveMeeting(lessonId: string, actor: Actor) {
    const lesson = await this.lessons.get(lessonId)
    const group = lesson && (await this.groups.get(lesson.groupId))
    if (!lesson || !group || !canSeeGroup(actor, group)) {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (lesson.status !== 'live') {
      throw new HttpException({ error: 'lesson_not_live' }, 409)
    }
    const meeting = await this.lessons.meetingForLesson(lesson.id)
    if (!meeting) throw new HttpException({ error: 'meeting_missing' }, 500)
    return { lesson, group, meeting }
  }
}
