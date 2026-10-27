import { describe, expect, it } from 'vitest'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from './lessons.service'

describe('LessonsService', () => {
  it('moves scheduled to live with a meeting room, then ended', () => {
    const groups = new GroupsService()
    const group = groups.create({ name: 'A1', actorId: 't1', role: 'teacher' })
    const lessons = new LessonsService(groups)
    const lesson = lessons.create({
      groupId: group.id,
      scheduledAt: '2026-11-01T09:00:00+05:00',
      role: 'teacher',
    })
    const started = lessons.start({ lessonId: lesson.id, role: 'teacher' })
    expect(started.lesson.status).toBe('live')
    expect(started.meeting.livekitRoom).toContain(lesson.id)
    expect(lessons.end({ lessonId: lesson.id, role: 'teacher' }).status).toBe(
      'ended',
    )
  })
})
