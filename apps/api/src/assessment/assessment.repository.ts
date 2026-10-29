import { Inject, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Database, type Executor } from '../db/database'
import {
  assignments,
  attempts,
  audioObjects,
  groupMembers,
  questions,
  testQuestions,
  tests,
  users,
} from '../db/schema'
import { isUuid } from '../db/uuid'
import type { TestQuestion } from './grading'

export type QuestionRow = typeof questions.$inferSelect
export type AttemptRow = typeof attempts.$inferSelect
export type AssignmentRow = typeof assignments.$inferSelect
export type AudioRow = typeof audioObjects.$inferSelect

export const toTestQuestion = (q: QuestionRow): TestQuestion => ({
  id: q.id,
  type: q.type,
  prompt: q.prompt,
  options: q.options,
  answerKey: q.answerKey,
})

@Injectable()
export class AssessmentRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  get db() {
    return this.database.db
  }

  async getQuestion(id: string, x: Executor = this.db) {
    if (!isUuid(id)) return null
    const [row] = await x
      .select()
      .from(questions)
      .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
    return row ?? null
  }

  listQuestions(status?: 'draft' | 'published') {
    return this.db
      .select()
      .from(questions)
      .where(
        and(
          isNull(questions.deletedAt),
          status ? eq(questions.status, status) : undefined,
        ),
      )
      .orderBy(desc(questions.createdAt), desc(questions.id))
  }

  /** The questions with these ids, deleted ones excluded. */
  async questionsByIds(ids: string[], x: Executor = this.db) {
    if (ids.length === 0) return []
    return x
      .select()
      .from(questions)
      .where(and(inArray(questions.id, ids), isNull(questions.deletedAt)))
  }

  async questionInUse(id: string, x: Executor = this.db) {
    const [row] = await x
      .select({ testId: testQuestions.testId })
      .from(testQuestions)
      .where(eq(testQuestions.questionId, id))
      .limit(1)
    return Boolean(row)
  }

  /** A test with its questions in order, or null. */
  async getTest(id: string, x: Executor = this.db) {
    if (!isUuid(id)) return null
    const [test] = await x.select().from(tests).where(eq(tests.id, id))
    if (!test) return null
    const rows = await x
      .select({ question: questions })
      .from(testQuestions)
      .innerJoin(questions, eq(questions.id, testQuestions.questionId))
      .where(eq(testQuestions.testId, id))
      .orderBy(asc(testQuestions.position))
    return { test, questions: rows.map((r) => r.question) }
  }

  listTests() {
    return this.db
      .select({
        id: tests.id,
        title: tests.title,
        createdAt: tests.createdAt,
        questionCount: sql<number>`(select count(*)::int from ${testQuestions} where ${testQuestions.testId} = ${tests.id})`,
      })
      .from(tests)
      .orderBy(desc(tests.createdAt), desc(tests.id))
  }

  /** Learners of the group, the people who get an attempt. */
  async learnerIds(groupId: string, x: Executor = this.db) {
    const rows = await x
      .select({ id: users.id })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(users.role, 'learner'),
          isNull(users.deletedAt),
        ),
      )
    return rows.map((r) => r.id)
  }

  async attemptWithAssignment(id: string, x: Executor = this.db) {
    if (!isUuid(id)) return null
    const [row] = await x
      .select({ attempt: attempts, assignment: assignments })
      .from(attempts)
      .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
      .where(eq(attempts.id, id))
    return row ?? null
  }

  /** Locks the attempt row until the transaction ends. */
  async lockAttempt(id: string, x: Executor) {
    const [row] = await x
      .select()
      .from(attempts)
      .where(eq(attempts.id, id))
      .for('update')
    return row as AttemptRow
  }

  audioFor(attemptId: string, x: Executor = this.db) {
    return x
      .select()
      .from(audioObjects)
      .where(eq(audioObjects.attemptId, attemptId))
  }

  async upsertAudio(
    row: typeof audioObjects.$inferInsert,
    x: Executor = this.db,
  ) {
    await x
      .insert(audioObjects)
      .values(row)
      .onConflictDoUpdate({
        target: [audioObjects.attemptId, audioObjects.questionId],
        set: {
          objectKey: row.objectKey,
          contentType: row.contentType,
          size: row.size,
          createdAt: new Date(),
        },
      })
  }

  listGroupAssignments(groupId: string) {
    return this.db
      .select({
        assignment: assignments,
        title: tests.title,
      })
      .from(assignments)
      .innerJoin(tests, eq(tests.id, assignments.testId))
      .where(eq(assignments.groupId, groupId))
      .orderBy(desc(assignments.deadline), desc(assignments.id))
  }

  attemptsOfAssignments(assignmentIds: string[]) {
    if (assignmentIds.length === 0) return Promise.resolve([])
    return this.db
      .select({
        id: attempts.id,
        assignmentId: attempts.assignmentId,
        userId: attempts.userId,
        name: users.name,
        status: attempts.status,
        score: attempts.score,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(inArray(attempts.assignmentId, assignmentIds))
      .orderBy(asc(users.name), asc(attempts.id))
  }

  listForLearner(userId: string) {
    return this.db
      .select({
        attemptId: attempts.id,
        assignmentId: assignments.id,
        groupId: assignments.groupId,
        title: tests.title,
        deadline: assignments.deadline,
        status: attempts.status,
        score: attempts.score,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
      .innerJoin(tests, eq(tests.id, assignments.testId))
      .where(eq(attempts.userId, userId))
      .orderBy(desc(assignments.deadline), desc(attempts.id))
  }

  /**
   * Marks every open attempt past its deadline as missed, in one statement, so
   * running it twice or from two instances changes nothing the second time.
   */
  async sweepMissed(now: Date): Promise<number> {
    const res = await this.db.execute(sql`
      update ${attempts} set status = 'missed'
      from ${assignments}
      where ${attempts.assignmentId} = ${assignments.id}
        and ${attempts.status} = 'assigned'
        and ${assignments.deadline} < ${now}`)
    return res.rowCount ?? 0
  }
}
