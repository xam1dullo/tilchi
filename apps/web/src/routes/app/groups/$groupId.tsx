import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { apiFetch } from '../../../lib/api'
import {
  formatLessonTime,
  lessonActions,
  type GroupRecord,
  type LessonRecord,
} from '../../../lib/classroom'
import { messages } from '../../../lib/i18n'
import { keepAppSearch } from '../../../lib/preview'

export const Route = createFileRoute('/app/groups/$groupId')({
  loader: async ({ context, params }) => {
    const [group, lessons] = await Promise.all([
      apiFetch<GroupRecord>(`/api/groups/${params.groupId}`, {
        previewRole: context.previewRole,
      }),
      apiFetch<{ lessons: LessonRecord[] }>(
        `/api/groups/${params.groupId}/lessons`,
        { previewRole: context.previewRole },
      ),
    ])
    return { group, lessons: lessons.lessons }
  },
  component: GroupPage,
})

function GroupPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { session, previewRole } = useRouteContext({ from: '/app' })
  const { group, lessons } = Route.useLoaderData()
  const copy = messages(locale)
  const role = session?.role ?? 'learner'
  const search = keepAppSearch(previewRole)
  const manage = lessonActions({ role, status: 'scheduled' })
  return (
    <section className="classroom">
      <p className="eyebrow">
        <Link to="/app" search={search}>
          {copy.groups}
        </Link>
      </p>
      <div className="classroom-head">
        <div>
          <h2>{group.name}</h2>
          <p className="hint">
            {copy.members} {group.memberIds.length}/{group.capacity}
          </p>
        </div>
        {manage.canSchedule ? (
          <ScheduleForm
            groupId={group.id}
            previewRole={previewRole}
            copy={{
              schedule: copy.scheduleLesson,
              time: copy.scheduledAt,
            }}
          />
        ) : null}
      </div>
      {lessons.length === 0 ? (
        <p className="hint">{copy.noLessons}</p>
      ) : (
        <ul className="rows classroom-list">
          {lessons.map((lesson) => {
            const actions = lessonActions({ role, status: lesson.status })
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
                <div>
                  <strong>
                    {formatLessonTime(lesson.scheduledAt, locale)}
                  </strong>
                  <span className={`tag status-${lesson.status}`}>
                    {status}
                  </span>
                </div>
                <LessonButtons
                  lesson={lesson}
                  actions={actions}
                  previewRole={previewRole}
                  search={search}
                  copy={{
                    start: copy.startLesson,
                    end: copy.endLesson,
                    join: copy.joinMeet,
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
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
      className="classroom-form"
      onSubmit={(event) => {
        event.preventDefault()
        setBusy(true)
        void apiFetch(`/api/groups/${groupId}/lessons`, {
          method: 'POST',
          previewRole,
          body: JSON.stringify({
            scheduledAt: new Date(scheduledAt).toISOString(),
          }),
        })
          .then(() => router.invalidate())
          .finally(() => setBusy(false))
      }}
    >
      <label>
        <span className="sr-only">{copy.time}</span>
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
  lesson,
  actions,
  previewRole,
  search,
  copy,
}: {
  lesson: LessonRecord
  actions: ReturnType<typeof lessonActions>
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
      {actions.canStart ? (
        <button
          className="btn btn-outline"
          type="button"
          disabled={busy}
          onClick={() => post(`/api/lessons/${lesson.id}/start`)}
        >
          {copy.start}
        </button>
      ) : null}
      {actions.canEnd ? (
        <button
          className="btn btn-outline"
          type="button"
          disabled={busy}
          onClick={() => post(`/api/lessons/${lesson.id}/end`)}
        >
          {copy.end}
        </button>
      ) : null}
      {actions.canJoin ? (
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
