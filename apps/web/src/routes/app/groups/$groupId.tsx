import { AppNotFound } from '../../app'
import { loadForSession, sessionData } from '../../../lib/session'
import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { apiFetch, loadDetail } from '../../../lib/api'
import {
  formatLessonTime,
  tashkentInputToIso,
  type GroupRecord,
  type LessonRecord,
} from '../../../lib/classroom'
import { EnrolPanel } from '../../../components/enrol-panel'
import {
  AssignForm,
  AssignmentsList,
} from '../../../components/group-assignments'
import { RetryButton } from '../../../components/retry-button'
import { loadAssessment } from '../../../lib/assignments'
import { displayName, type Member } from '../../../lib/enrol'
import { messages, type Copy } from '../../../lib/i18n'
import { keepAppSearch } from '../../../lib/preview'

export const Route = createFileRoute('/app/groups/$groupId')({
  loader: ({ context, params }) =>
    loadForSession(context.session, async () => {
      const group = await loadDetail(() =>
        apiFetch<GroupRecord>(`/api/groups/${params.groupId}`, {
          previewRole: context.previewRole,
        }),
      )
      const lessons = await apiFetch<{ lessons: LessonRecord[] }>(
        `/api/groups/${params.groupId}/lessons`,
        { previewRole: context.previewRole },
      )
      const { previewRole } = context
      const path = `/api/groups/${params.groupId}`
      const [{ members }, { tests, assignments }] = await Promise.all([
        group.can.seeMembers
          ? apiFetch<{ members: Member[] }>(`${path}/members`, {
              previewRole,
            })
          : { members: [] },
        loadAssessment(group.can, group.id, (url) =>
          apiFetch(url, { previewRole }),
        ),
      ])
      return { group, lessons: lessons.lessons, members, tests, assignments }
    }),
  notFoundComponent: AppNotFound,
  component: GroupPage,
  errorComponent: GroupError,
})

function GroupError() {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div role="alert" className="error-row">
      <p>{copy.error}</p>
      <RetryButton label={copy.retry} />
    </div>
  )
}

function GroupPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const { group, lessons, members, tests, assignments } = sessionData(
    Route.useLoaderData(),
  )
  const copy = messages(locale)
  const search = keepAppSearch(previewRole)
  const nextLesson = lessons.reduce<LessonRecord | undefined>(
    (next, lesson) =>
      lesson.status === 'scheduled' &&
      (!next || Date.parse(lesson.scheduledAt) < Date.parse(next.scheduledAt))
        ? lesson
        : next,
    undefined,
  )
  const lessonCopy = {
    start: copy.startLesson,
    end: copy.endLesson,
    join: copy.joinMeet,
  }
  return (
    <section className="classroom group-page">
      <p className="eyebrow">
        <Link to="/app" search={search}>
          {copy.groups}
        </Link>
      </p>
      <div className="classroom-head">
        <div>
          <h2>{group.name}</h2>
          <p className="hint">
            {copy.members} {group.learnerCount}/{group.capacity}
          </p>
        </div>
      </div>
      <div className="group-layout">
        <aside className="group-lessons" aria-labelledby="group-lessons-title">
          <h3 id="group-lessons-title">{copy.groupLessons}</h3>
          {lessons.length === 0 ? (
            <p className="hint">{copy.noLessons}</p>
          ) : (
            <ul className="rows classroom-list">
              {lessons.map((lesson, index) => {
                const status =
                  lesson.status === 'live'
                    ? copy.lessonLive
                    : lesson.status === 'ended'
                      ? copy.lessonEnded
                      : lesson.status === 'cancelled'
                        ? copy.lessonCancelled
                        : copy.lessonScheduled
                return (
                  <li key={lesson.id} className="row classroom-row lesson-row">
                    <span className="group-lesson-index" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="group-lesson-meta">
                      <strong>
                        {formatLessonTime(lesson.scheduledAt, locale)}
                      </strong>
                      <span className={`tag status-${lesson.status}`}>
                        {status}
                      </span>
                    </div>
                    {lesson.id !== nextLesson?.id ? (
                      <LessonButtons
                        lesson={lesson}
                        previewRole={previewRole}
                        search={search}
                        copy={lessonCopy}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          {nextLesson ? (
            <LessonButtons
              lesson={nextLesson}
              previewRole={previewRole}
              search={search}
              copy={lessonCopy}
              primary
            />
          ) : null}
        </aside>
        <div className="group-main">
          {group.can.createLesson ? (
            <ScheduleForm
              groupId={group.id}
              previewRole={previewRole}
              copy={{
                schedule: copy.scheduleLesson,
                time: copy.lessonDateTime,
              }}
            />
          ) : null}
          {group.can.assignTest ? (
            <AssignForm
              groupId={group.id}
              previewRole={previewRole}
              tests={tests}
              copy={copy}
            />
          ) : null}
          {group.can.viewAssignments ? (
            <AssignmentsList
              assignments={assignments}
              copy={copy}
              locale={locale}
              canGrade={group.can.gradeAttempts}
              previewRole={previewRole}
            />
          ) : null}
          {group.can.seeMembers ? (
            <MembersList members={members} copy={copy} />
          ) : null}
          {group.can.manageMembers ? (
            <EnrolPanel group={group} previewRole={previewRole} copy={copy} />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function MembersList({ members, copy }: { members: Member[]; copy: Copy }) {
  const role = {
    learner: copy.roleLearner,
    teacher: copy.roleTeacher,
    admin: copy.roleAdmin,
  }
  return (
    <section className="members" aria-labelledby="members-title">
      <h3 id="members-title">{copy.members}</h3>
      <ul className="rows classroom-list">
        {members.map((member) => (
          <li key={member.id} className="row classroom-row">
            <strong>{displayName(member)}</strong>
            <span className="tag">{role[member.role]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ScheduleForm({
  groupId,
  previewRole,
  copy,
}: {
  groupId: string
  previewRole: 'learner' | 'teacher' | 'admin' | null
  copy: { schedule: string; time: string }
}) {
  const router = useRouter()
  const [scheduledAt, setScheduledAt] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="classroom-form group-schedule"
      onSubmit={(event) => {
        event.preventDefault()
        const iso = tashkentInputToIso(scheduledAt)
        if (!iso) return
        setBusy(true)
        void apiFetch(`/api/groups/${groupId}/lessons`, {
          method: 'POST',
          previewRole,
          body: JSON.stringify({ scheduledAt: iso }),
        })
          .then(() => router.invalidate())
          .finally(() => setBusy(false))
      }}
    >
      <label>
        <span>{copy.time} (Asia/Tashkent)</span>
        <input
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {copy.schedule}
      </button>
    </form>
  )
}

function LessonButtons({
  primary = false,
  lesson,
  previewRole,
  search,
  copy,
}: {
  primary?: boolean
  lesson: LessonRecord
  previewRole: 'learner' | 'teacher' | 'admin' | null
  search: ReturnType<typeof keepAppSearch>
  copy: { start: string; end: string; join: string }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const post = (path: string) => {
    setBusy(true)
    void apiFetch(path, { method: 'POST', previewRole })
      .then(() => router.invalidate())
      .finally(() => setBusy(false))
  }
  return (
    <div className="lesson-actions">
      {lesson.can.start ? (
        <button
          className={primary ? 'btn btn-primary' : 'btn btn-outline'}
          type="button"
          disabled={busy}
          onClick={() => post(`/api/lessons/${lesson.id}/start`)}
        >
          {copy.start}
        </button>
      ) : null}
      {lesson.can.end ? (
        <button
          className="btn btn-outline"
          type="button"
          disabled={busy}
          onClick={() => post(`/api/lessons/${lesson.id}/end`)}
        >
          {copy.end}
        </button>
      ) : null}
      {lesson.can.join ? (
        <Link
          className="btn btn-primary"
          to="/app/meet/$lessonId"
          params={{ lessonId: lesson.id }}
          search={search}
        >
          {copy.join}
        </Link>
      ) : null}
    </div>
  )
}
