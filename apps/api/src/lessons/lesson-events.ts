import { Injectable } from '@nestjs/common'

export type LessonEvent =
  | {
      type: 'lesson.cancelled'
      lessonId: string
      groupId: string
      scheduledAt: string
    }
  | {
      type: 'lesson.rescheduled'
      lessonId: string
      groupId: string
      scheduledAt: string
      previousScheduledAt: string
    }

/**
 * In-process domain events. Notification delivery (web + bot, see the PRD
 * Notification Catalog) subscribes later; nothing is delivered from here.
 */
@Injectable()
export class LessonEvents {
  private readonly handlers: Array<(event: LessonEvent) => void> = []

  on(handler: (event: LessonEvent) => void) {
    this.handlers.push(handler)
  }

  emit(event: LessonEvent) {
    for (const handler of this.handlers) handler(event)
  }
}
