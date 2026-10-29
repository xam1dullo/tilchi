import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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
export const questionType = pgEnum('question_type', [
  'single',
  'multi',
  'speaking',
])
export const questionStatus = pgEnum('question_status', ['draft', 'published'])
export const attemptStatus = pgEnum('attempt_status', [
  'assigned',
  'submitted',
  'graded',
  'missed',
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
  /** Newest Telegram update applied to this registration; replays are refused. */
  lastUpdateId: bigint('last_update_id', { mode: 'number' }),
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

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  segment: text('segment').notNull(),
  level: text('level').notNull(),
  published: boolean('published').notNull().default(false),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
  deletedAt: tstz('deleted_at'),
})

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

/**
 * Transactional outbox: rows are written in the same transaction as the domain
 * change, then drained by a worker. `idempotencyKey` makes a repeated enqueue
 * a no-op; a row with `sentAt` or `failedAt` set is finished.
 */
export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey(),
    event: text('event').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    availableAt: tstz('available_at').notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    sentAt: tstz('sent_at'),
    /** Set when the attempts ran out; the row is never retried again. */
    failedAt: tstz('failed_at'),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('outbox_pending_idx')
      .on(table.availableAt)
      .where(sql`${table.sentAt} is null and ${table.failedAt} is null`),
  ],
)

/** One Telegram message already sent for an outbox row: a retry skips it. */
export const outboxDeliveries = pgTable(
  'outbox_deliveries',
  {
    outboxId: uuid('outbox_id').notNull(),
    chatId: text('chat_id').notNull(),
    sentAt: tstz('sent_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.outboxId, table.chatId] })],
)

/** The web inbox. */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    event: text('event').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link'),
    readAt: tstz('read_at'),
    createdAt: tstz('created_at').notNull().defaultNow(),
    /** The outbox row that produced it; a redelivered row adds nothing. */
    outboxId: uuid('outbox_id'),
  },
  (table) => [
    index('notifications_user_created_idx').on(table.userId, table.createdAt),
    uniqueIndex('notifications_outbox_user_idx').on(
      table.outboxId,
      table.userId,
    ),
  ],
)

export type QuestionOption = { id: string; text: string }
/** Points one question earned when its attempt was graded. */
export type QuestionResult = { points: number; max: number }

/**
 * The shared question bank. A choice question has options and an answer key
 * (option ids); a speaking question has neither. Only a draft may change.
 */
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey(),
    type: questionType('type').notNull(),
    prompt: text('prompt').notNull(),
    options: jsonb('options').$type<QuestionOption[]>(),
    answerKey: jsonb('answer_key').$type<string[]>(),
    status: questionStatus('status').notNull().default('draft'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    createdAt: tstz('created_at').notNull().defaultNow(),
    updatedAt: tstz('updated_at').notNull().defaultNow(),
    deletedAt: tstz('deleted_at'),
  },
  (table) => [
    check(
      'questions_shape',
      sql`(${table.type} = 'speaking' and ${table.options} is null and ${table.answerKey} is null)
        or (${table.type} <> 'speaking' and ${table.options} is not null and ${table.answerKey} is not null)`,
    ),
  ],
)

/** A test is an ordered list of published questions and never changes. */
export const tests = pgTable('tests', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  createdAt: tstz('created_at').notNull().defaultNow(),
})

export const testQuestions = pgTable(
  'test_questions',
  {
    testId: uuid('test_id')
      .notNull()
      .references(() => tests.id),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.testId, table.questionId] }),
    uniqueIndex('test_questions_position_idx').on(table.testId, table.position),
    index('test_questions_question_idx').on(table.questionId),
  ],
)

/** A test given to one Group with a deadline; attempts are made for its learners. */
export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey(),
    testId: uuid('test_id')
      .notNull()
      .references(() => tests.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id),
    deadline: tstz('deadline').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (table) => [index('assignments_group_idx').on(table.groupId)],
)

/**
 * One attempt per learner per assignment (the unique key). The check keeps the
 * state machine honest in the data: a graded row always carries its grade.
 */
export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: attemptStatus('status').notNull().default('assigned'),
    /** Question id to the chosen option ids. Speaking answers live in audio_objects. */
    answers: jsonb('answers')
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    score: integer('score'),
    /** Question id to the points it earned, kept for the learner's review. */
    result: jsonb('result').$type<Record<string, QuestionResult>>(),
    feedback: text('feedback'),
    submittedAt: tstz('submitted_at'),
    gradedAt: tstz('graded_at'),
    gradedBy: uuid('graded_by').references(() => users.id),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('attempts_assignment_user_idx').on(
      table.assignmentId,
      table.userId,
    ),
    index('attempts_user_idx').on(table.userId),
    index('attempts_open_idx')
      .on(table.assignmentId)
      .where(sql`${table.status} = 'assigned'`),
    check(
      'attempts_state_shape',
      sql`(${table.status} not in ('submitted', 'graded') or ${table.submittedAt} is not null)
        and (${table.status} <> 'graded'
          or (${table.score} is not null and ${table.gradedAt} is not null and ${table.gradedBy} is not null))`,
    ),
  ],
)

/** One recorded speaking answer: the object key in the in-country bucket. */
export const audioObjects = pgTable(
  'audio_objects',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    objectKey: text('object_key').notNull().unique(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.attemptId, table.questionId] })],
)
