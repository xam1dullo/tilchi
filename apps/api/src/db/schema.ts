import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['learner', 'teacher', 'admin'])
export const lessonStatus = pgEnum('lesson_status', [
  'scheduled',
  'live',
  'ended',
  'cancelled',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  telegramUserId: text('telegram_user_id').unique(),
  role: userRole('role').notNull().default('learner'),
  name: text('name'),
  languageLevel: text('language_level'),
  studyHistory: text('study_history'),
  phone: text('phone'),
  goal: text('goal'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  secretHash: text('secret_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull().default(12),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const groupMembers = pgTable('group_members', {
  id: uuid('id').primaryKey(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: lessonStatus('status').notNull().default('scheduled'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey(),
  lessonId: uuid('lesson_id')
    .notNull()
    .references(() => lessons.id),
  livekitRoom: text('livekit_room').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
})
