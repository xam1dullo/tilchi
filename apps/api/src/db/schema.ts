import { sql } from 'drizzle-orm'
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['learner', 'teacher', 'admin'])
export const groupKind = pgEnum('group_kind', ['adult', 'kids'])
export const lessonStatus = pgEnum('lesson_status', [
  'scheduled',
  'live',
  'ended',
  'cancelled',
])
export const attendanceKind = pgEnum('attendance_kind', [
  'token',
  'join',
  'leave',
])

/** Every instant is stored in UTC and shown in Asia/Tashkent by the clients. */
const tstz = (name: string) => timestamp(name, { withTimezone: true })

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  /** Null only for demo users, which never sign in through Telegram. */
  telegramId: text('telegram_id').unique(),
  name: text('name'),
  role: userRole('role').notNull().default('learner'),
  level: text('level'),
  studyHistory: text('study_history'),
  phone: text('phone'),
  goal: text('goal'),
  /** The bot start payload that brought the user in, e.g. `ielts_orta`. */
  source: text('source'),
  consentAt: tstz('consent_at'),
  consentVersion: text('consent_version'),
  /** Who gave a minor's guardian consent, and when. */
  guardianConsentBy: text('guardian_consent_by'),
  guardianConsentAt: tstz('guardian_consent_at'),
  createdAt: tstz('created_at').notNull().defaultNow(),
  deletedAt: tstz('deleted_at'),
})

/** Postgres is the source of truth; Redis only caches a read for 5 minutes. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: tstz('created_at').notNull().defaultNow(),
    lastSeenAt: tstz('last_seen_at').notNull().defaultNow(),
    /** Sliding idle expiry, never later than `absoluteExpiresAt`. */
    expiresAt: tstz('expires_at').notNull(),
    absoluteExpiresAt: tstz('absolute_expires_at').notNull(),
    revokedAt: tstz('revoked_at'),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    check(
      'sessions_expiry_order',
      sql`${table.expiresAt} <= ${table.absoluteExpiresAt}`,
    ),
  ],
)

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id),
    kind: groupKind('kind').notNull().default('adult'),
    /** Courses arrive with the catalog phase, which adds the foreign key. */
    courseId: uuid('course_id'),
    createdAt: tstz('created_at').notNull().defaultNow(),
    deletedAt: tstz('deleted_at'),
  },
  (table) => [index('groups_teacher_id_idx').on(table.teacherId)],
)

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    addedAt: tstz('added_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index('group_members_user_id_idx').on(table.userId),
  ],
)

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id),
    scheduledAt: tstz('scheduled_at').notNull(),
    status: lessonStatus('status').notNull().default('scheduled'),
    startedAt: tstz('started_at'),
    endedAt: tstz('ended_at'),
    cancelledAt: tstz('cancelled_at'),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('lessons_group_id_scheduled_at_idx').on(
      table.groupId,
      table.scheduledAt,
    ),
  ],
)

/** One Meeting per Lesson: the unique `lesson_id` makes a second one impossible. */
export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey(),
  lessonId: uuid('lesson_id')
    .notNull()
    .unique()
    .references(() => lessons.id),
  livekitRoom: text('livekit_room').notNull().unique(),
  openedAt: tstz('opened_at'),
  closedAt: tstz('closed_at'),
})

export const attendanceEvents = pgTable(
  'attendance_events',
  {
    id: uuid('id').primaryKey(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: attendanceKind('kind').notNull(),
    at: tstz('at').notNull().defaultNow(),
    /** LiveKit webhook event id; unique, so a redelivered webhook is a no-op. */
    livekitEventId: text('livekit_event_id').unique(),
  },
  (table) => [
    index('attendance_events_lesson_user_idx').on(table.lessonId, table.userId),
  ],
)
