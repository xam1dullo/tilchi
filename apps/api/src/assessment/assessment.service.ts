import { randomUUID } from 'node:crypto'
import { HttpException, Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { type Actor, authorize, can } from '../authz/policy'
import {
  assignments,
  attempts,
  audioObjects,
  groups,
  questions,
  testQuestions,
  tests,
} from '../db/schema'
import { isUuid } from '../db/uuid'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import type { OutboxEntry, TestPayload } from '../outbox/events'
import { enqueue, enqueueAll } from '../outbox/outbox.repository'
import { OutboxWorker } from '../outbox/outbox.worker'
import {
  ObjectStorage,
  audioKey,
  submittedKey,
} from '../storage/object-storage'
import {
  AssessmentRepository,
  type AssignmentRow,
  type AttemptRow,
  type AudioRow,
  type QuestionRow,
  toTestQuestion,
} from './assessment.repository'
import { acceptsAnswers, effectiveStatus, transition } from './attempt-state'
import { type TestQuestion, gradeAttempt, isCorrect, maxScore } from './grading'
import {
  parseAnswers,
  parseAssign,
  parseGrade,
  parseNewQuestion,
  parsePresign,
  parseQuestionPatch,
  parseTest,
} from './inputs'

const HOUR_MS = 60 * 60 * 1000

const fail = (status: number, error: string): never => {
  throw new HttpException({ error }, status)
}
const notFound = () => fail(404, 'not_found')

/** What a question looks like to a manager (with the key) or a learner (without). */
function questionView(q: QuestionRow, withKey: boolean) {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    ...(withKey ? { answerKey: q.answerKey, status: q.status } : {}),
  }
}

/** The deadline-driven outbox rows: reminders only for moments still ahead. */
export function assignmentEntries(
  assignment: Pick<AssignmentRow, 'id' | 'groupId' | 'deadline'>,
  now: Date,
): OutboxEntry[] {
  const payload = (
    lead?: '24h' | '3h',
  ): TestPayload & Record<string, unknown> => ({
    assignmentId: assignment.id,
    groupId: assignment.groupId,
    deadline: assignment.deadline.toISOString(),
    ...(lead ? { lead } : {}),
  })
  const reminders = (['24h', '3h'] as const).flatMap((lead) => {
    const availableAt = new Date(
      assignment.deadline.getTime() - (lead === '24h' ? 24 : 3) * HOUR_MS,
    )
    return availableAt > now
      ? [
          {
            event: 'test.reminder' as const,
            payload: payload(lead),
            idempotencyKey: `test.reminder.${lead}:${assignment.id}`,
            availableAt,
          },
        ]
      : []
  })
  return [
    {
      event: 'test.assigned',
      payload: payload(),
      idempotencyKey: `test.assigned:${assignment.id}`,
    },
    ...reminders,
  ]
}

type Who = 'owner' | 'manager' | 'either'

@Injectable()
export class AssessmentService {
  constructor(
    @Inject(AssessmentRepository) private readonly repo: AssessmentRepository,
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
    @Inject(OutboxWorker) private readonly worker: OutboxWorker,
  ) {}

  // --- question bank ---

  async listQuestions(actor: Actor, status: unknown) {
    authorize(actor, 'question.manage')
    const only =
      status === 'draft' || status === 'published' ? status : undefined
    const rows = await this.repo.listQuestions(only)
    return { questions: rows.map((q) => questionView(q, true)) }
  }

  async createQuestion(actor: Actor, body: unknown) {
    authorize(actor, 'question.manage')
    const draft = parseNewQuestion(body)
    const [row] = await this.repo.db
      .insert(questions)
      .values({ ...draft, id: uuidv7(), authorId: actor.userId })
      .returning()
    return questionView(row, true)
  }

  async updateQuestion(actor: Actor, id: string, body: unknown) {
    authorize(actor, 'question.manage')
    const existing = await this.repo.getQuestion(id)
    if (!existing) return notFound()
    const patch = parseQuestionPatch(body, existing)
    if (existing.status !== 'draft') return fail(409, 'not_draft')
    const [row] = await this.repo.db
      .update(questions)
      .set({
        ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
        ...(patch.options ? { options: patch.options } : {}),
        ...(patch.answerKey ? { answerKey: patch.answerKey } : {}),
        ...(patch.publish ? { status: 'published' as const } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(questions.id, id),
          eq(questions.status, 'draft'),
          isNull(questions.deletedAt),
        ),
      )
      .returning()
    // Lost a race with another publish: the question is no longer a draft.
    if (!row) return fail(409, 'not_draft')
    return questionView(row, true)
  }

  async removeQuestion(actor: Actor, id: string) {
    authorize(actor, 'question.manage')
    if (!isUuid(id)) return notFound()
    return this.repo.db.transaction(async (tx) => {
      if (await this.repo.questionInUse(id, tx)) return fail(409, 'in_use')
      const gone = await tx
        .update(questions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
        .returning({ id: questions.id })
      if (gone.length === 0) return notFound()
      return { ok: true }
    })
  }

  // --- tests ---

  async createTest(actor: Actor, body: unknown) {
    authorize(actor, 'test.manage')
    const input = parseTest(body)
    const id = uuidv7()
    await this.repo.db.transaction(async (tx) => {
      const found = await this.repo.questionsByIds(input.questionIds, tx)
      if (
        found.length !== input.questionIds.length ||
        found.some((q) => q.status !== 'published')
      ) {
        return fail(400, 'invalid_questions')
      }
      await tx
        .insert(tests)
        .values({ id, title: input.title, authorId: actor.userId })
      await tx.insert(testQuestions).values(
        input.questionIds.map((questionId, position) => ({
          testId: id,
          questionId,
          position,
        })),
      )
    })
    return this.getTest(actor, id)
  }

  async getTest(actor: Actor, id: string) {
    authorize(actor, 'test.manage')
    const found = await this.repo.getTest(id)
    if (!found) return notFound()
    return {
      id: found.test.id,
      title: found.test.title,
      createdAt: found.test.createdAt,
      maxScore: maxScore(found.questions),
      questions: found.questions.map((q) => questionView(q, true)),
    }
  }

  async listTests(actor: Actor) {
    authorize(actor, 'test.manage')
    return { tests: await this.repo.listTests() }
  }

  // --- assignments ---

  async assign(actor: Actor, groupId: string, body: unknown) {
    const group = await this.groups.get(groupId)
    if (!group) return notFound()
    authorize(actor, 'test.assign', group)
    const now = new Date()
    const input = parseAssign(body, now)
    const found = await this.repo.getTest(input.testId)
    if (!found) return notFound()
    const assignment = await this.repo.db.transaction(async (tx) => {
      // Same lock as adding a member: a learner joining right now gets an
      // attempt either here or there, never neither.
      await tx
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.id, groupId))
        .for('update')
      const [created] = await tx
        .insert(assignments)
        .values({
          id: uuidv7(),
          testId: input.testId,
          groupId,
          deadline: input.deadline,
          createdBy: actor.userId,
        })
        .returning()
      const learners = await this.repo.learnerIds(groupId, tx)
      if (learners.length > 0) {
        await tx.insert(attempts).values(
          learners.map((userId) => ({
            id: uuidv7(),
            assignmentId: created.id,
            userId,
          })),
        )
      }
      await enqueueAll(tx, assignmentEntries(created, now))
      return created
    })
    this.worker.kick()
    return {
      id: assignment.id,
      testId: assignment.testId,
      groupId,
      deadline: assignment.deadline,
    }
  }

  async listForGroup(actor: Actor, groupId: string) {
    const group = await this.groups.get(groupId)
    if (!group) return notFound()
    authorize(actor, 'assignment.view', group)
    const rows = await this.repo.listGroupAssignments(groupId)
    const all = await this.repo.attemptsOfAssignments(
      rows.map((r) => r.assignment.id),
    )
    const now = new Date()
    return {
      assignments: rows.map(({ assignment, title }) => ({
        id: assignment.id,
        testId: assignment.testId,
        title,
        deadline: assignment.deadline,
        attempts: all
          .filter((a) => a.assignmentId === assignment.id)
          .map((a) => ({
            id: a.id,
            userId: a.userId,
            name: a.name,
            status: effectiveStatus(a.status, {
              now,
              deadline: assignment.deadline,
            }),
            score: a.score,
            submittedAt: a.submittedAt,
          })),
      })),
    }
  }

  async listMine(actor: Actor) {
    authorize(actor, 'attempt.take')
    const now = new Date()
    const rows = await this.repo.listForLearner(actor.userId)
    return {
      assignments: rows.map((r) => ({
        ...r,
        status: effectiveStatus(r.status, { now, deadline: r.deadline }),
      })),
    }
  }

  // --- attempts ---

  /**
   * Loads an attempt for a caller who may touch it. The owner may read, answer
   * and upload; the Group's teacher or an admin may read and grade. Anyone else
   * gets a 404 (an attempt's existence is private); the owner trying to grade
   * gets a 403.
   */
  private async context(actor: Actor, id: string, who: Who) {
    const row = await this.repo.attemptWithAssignment(id)
    if (!row) return notFound()
    const group = await this.groups.get(row.assignment.groupId)
    const owner = row.attempt.userId === actor.userId
    const manager = Boolean(group && can(actor, 'attempt.grade', group))
    if (who !== 'owner' && manager) return { ...row, as: 'manager' as const }
    if (who !== 'manager' && owner) return { ...row, as: 'owner' as const }
    if (who === 'manager' && owner) return fail(403, 'forbidden')
    return notFound()
  }

  private async loadTest(testId: string) {
    const found = await this.repo.getTest(testId)
    if (!found) return notFound()
    return found.questions.map(toTestQuestion)
  }

  async getAttempt(actor: Actor, id: string) {
    const ctx = await this.context(actor, id, 'either')
    const found = await this.repo.getTest(ctx.assignment.testId)
    if (!found) return notFound()
    const audio = await this.repo.audioFor(ctx.attempt.id)
    const view = this.view(
      ctx.attempt,
      { ...ctx.assignment, title: found.test.title },
      found.questions.map(toTestQuestion),
      audio,
      ctx.as,
    )
    return ctx.as === 'manager'
      ? {
          ...view,
          learnerName: await this.repo.learnerName(ctx.attempt.userId),
          groupId: ctx.assignment.groupId,
        }
      : view
  }

  private view(
    attempt: AttemptRow,
    assignment: AssignmentRow & { title: string },
    test: TestQuestion[],
    audio: AudioRow[],
    as: 'owner' | 'manager',
  ) {
    const now = new Date()
    const status = effectiveStatus(attempt.status, {
      now,
      deadline: assignment.deadline,
    })
    const manager = as === 'manager'
    const revealed = manager || attempt.status === 'graded'
    return {
      id: attempt.id,
      assignmentId: assignment.id,
      title: assignment.title,
      userId: attempt.userId,
      status,
      deadline: assignment.deadline,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
      score: attempt.score,
      maxScore: maxScore(test),
      feedback: attempt.status === 'graded' ? attempt.feedback : null,
      answers: attempt.answers,
      recorded: audio.map((a) => a.questionId),
      questions: test.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        ...(manager
          ? {
              answerKey: q.answerKey,
              autoCorrect:
                q.type === 'speaking'
                  ? null
                  : isCorrect(q, attempt.answers[q.id]),
            }
          : {}),
        ...(revealed && attempt.result?.[q.id]
          ? { result: attempt.result[q.id] }
          : {}),
      })),
    }
  }

  async submit(actor: Actor, id: string, body: unknown) {
    const ctx = await this.context(actor, id, 'owner')
    const test = await this.loadTest(ctx.assignment.testId)
    const answers = parseAnswers(body, test)
    // Freeze each recording under a key no upload url can reach; an upload
    // that never finished has nothing to copy and is dropped. Copy only while
    // the attempt is open: a repeat or late submit is refused under the lock
    // below and must not touch storage.
    const now = new Date()
    const frozen = new Map<string, string>()
    const open = acceptsAnswers(ctx.attempt.status, {
      now,
      deadline: ctx.assignment.deadline,
    })
    const submitId = randomUUID()
    for (const row of open ? await this.repo.audioFor(id) : []) {
      if (!row.objectKey.startsWith('audio/')) continue
      const key = submittedKey(row.objectKey, submitId)
      if (await this.storage.copy(row.objectKey, key))
        frozen.set(row.objectKey, key)
    }
    const next = await this.repo.db.transaction(async (tx) => {
      const locked = await this.repo.lockAttempt(id, tx)
      const step = transition(locked.status, 'submit', {
        now,
        deadline: ctx.assignment.deadline,
      })
      if (step.refused) {
        // A late submit still records the miss, in the same transaction.
        if (step.status !== locked.status) {
          await tx
            .update(attempts)
            .set({ status: step.status })
            .where(eq(attempts.id, id))
        }
        return step
      }
      // Re-read under the lock: a url issued after the copies above names a
      // key that was never frozen, so that recording does not count.
      for (const row of await this.repo.audioFor(id, tx)) {
        const key = frozen.get(row.objectKey)
        const where = and(
          eq(audioObjects.attemptId, id),
          eq(audioObjects.questionId, row.questionId),
        )
        if (key) {
          await tx.update(audioObjects).set({ objectKey: key }).where(where)
        } else {
          await tx.delete(audioObjects).where(where)
        }
      }
      await tx
        .update(attempts)
        .set({ status: 'submitted', answers, submittedAt: now })
        .where(eq(attempts.id, id))
      await enqueue(tx, {
        event: 'test.submitted',
        payload: {
          assignmentId: ctx.assignment.id,
          groupId: ctx.assignment.groupId,
          deadline: ctx.assignment.deadline.toISOString(),
          attemptId: id,
          userId: actor.userId,
        },
        idempotencyKey: `test.submitted:${id}`,
      })
      return step
    })
    if (next.refused) return fail(409, next.refused)
    this.worker.kick()
    return this.getAttempt(actor, id)
  }

  async presignAudio(actor: Actor, id: string, body: unknown) {
    const ctx = await this.context(actor, id, 'owner')
    const input = parsePresign(body)
    const test = await this.loadTest(ctx.assignment.testId)
    if (test.find((q) => q.id === input.questionId)?.type !== 'speaking') {
      return fail(400, 'not_speaking_question')
    }
    const objectKey = audioKey(
      id,
      input.questionId,
      input.contentType,
      randomUUID(),
    )
    // The state check and the row write share one lock, so a submit that wins
    // the race leaves the recording untouched.
    const refused = await this.repo.db.transaction(async (tx) => {
      const locked = await this.repo.lockAttempt(id, tx)
      const at = { now: new Date(), deadline: ctx.assignment.deadline }
      if (acceptsAnswers(locked.status, at)) {
        await this.repo.upsertAudio(
          {
            attemptId: id,
            questionId: input.questionId,
            objectKey,
            contentType: input.contentType,
            size: input.size,
          },
          tx,
        )
        return null
      }
      return (
        transition(locked.status, 'submit', at).refused ?? 'deadline_passed'
      )
    })
    if (refused) return fail(409, refused)
    return this.storage.presignUpload(objectKey, input.contentType, input.size)
  }

  async playbackUrl(actor: Actor, id: string, questionId: string) {
    await this.context(actor, id, 'either')
    if (!isUuid(questionId)) return notFound()
    const rows = await this.repo.audioFor(id)
    const row = rows.find((r) => r.questionId === questionId)
    if (!row) return notFound()
    return {
      url: this.storage.presignDownload(row.objectKey),
      contentType: row.contentType,
    }
  }

  async grade(actor: Actor, id: string, body: unknown) {
    const ctx = await this.context(actor, id, 'manager')
    const test = await this.loadTest(ctx.assignment.testId)
    const input = parseGrade(body, test)
    const now = new Date()
    const result = await this.repo.db.transaction(async (tx) => {
      const locked = await this.repo.lockAttempt(id, tx)
      const step = transition(locked.status, 'grade', {
        now,
        deadline: ctx.assignment.deadline,
      })
      if (step.refused) return step.refused
      const recorded = new Set(
        (await this.repo.audioFor(id, tx)).map((a) => a.questionId),
      )
      const graded = gradeAttempt(test, locked.answers, recorded, input)
      if (!graded.ok) return graded.error
      await tx
        .update(attempts)
        .set({
          status: 'graded',
          score: graded.score,
          result: graded.result,
          feedback: input.feedback,
          gradedAt: now,
          gradedBy: actor.userId,
        })
        .where(eq(attempts.id, id))
      await enqueue(tx, {
        event: 'test.graded',
        payload: {
          assignmentId: ctx.assignment.id,
          groupId: ctx.assignment.groupId,
          deadline: ctx.assignment.deadline.toISOString(),
          attemptId: id,
          userId: ctx.attempt.userId,
        },
        idempotencyKey: `test.graded:${id}`,
      })
      return null
    })
    if (result === 'speaking_score_required') return fail(400, result)
    if (result) return fail(409, result)
    this.worker.kick()
    return this.getAttempt(actor, id)
  }

  /** Marks overdue open attempts missed. Safe to run any time, any number of times. */
  sweep(now: Date) {
    return this.repo.sweepMissed(now)
  }
}
