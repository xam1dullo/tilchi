import { AppNotFound } from '../../app'
import { loadForSession, sessionData } from '../../../lib/session'
import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { apiFetch, loadDetail } from '../../../lib/api'
import {
  formatLessonTime,
  nextGroupLesson,
  tashkentInputToIso,
  type GroupRecord,
  type LessonRecord,
} from '../../../lib/classroom'
import { EnrolPanel } from '../../../components/enrol-panel'
import {
  LessonActions,
  type LessonActionsCopy,
} from '../../../components/lesson-actions'
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
  const [now, setNow] = useState<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [listOverflows, setListOverflows] = useState(false)
  useEffect(() => {
    setNow(Date.now())
  }, [])
  useEffect(() => {
    const list = listRef.current
    if (!list || lessons.length === 0) {
      setListOverflows(false)
      return
    }
    const measure = () =>
      setListOverflows(list.scrollHeight > list.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [lessons])
  const nextLesson = nextGroupLesson(lessons, now)
  const primaryLesson =
    nextLesson &&
    (nextLesson.can.start || nextLesson.can.end || nextLesson.can.join)
      ? nextLesson
      : undefined
  const lessonCopy = {
    start: copy.startLesson,
    end: copy.endLesson,
    join: copy.joinMeet,
    confirmEnd: copy.confirmEndLesson,
    confirmEndHint: copy.confirmEndLessonHint,
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
      </div>
      <div className="group-layout">
        <aside className="group-lessons" aria-labelledby="group-lessons-title">
          <h3 id="group-lessons-title">{copy.groupLessons}</h3>
          {primaryLesson ? (
            <div className="group-lesson-primary">
              <LessonMeta
                lesson={primaryLesson}
                locale={locale}
                copy={copy}
                primary
              />
              <LessonButtons
                lesson={primaryLesson}
                previewRole={previewRole}
                search={search}
                copy={lessonCopy}
                primary
              />
            </div>
          ) : null}
          {lessons.length === 0 ? (
            <p className="hint">{copy.noLessons}</p>
          ) : (
            <ul
              ref={listRef}
              className="rows classroom-list group-lessons-scroll"
              aria-labelledby="group-lessons-title"
              tabIndex={listOverflows ? 0 : undefined}
            >
              {lessons.map((lesson, index) => {
                return (
                  <li key={lesson.id} className="row classroom-row lesson-row">
                    <span className="group-lesson-index" aria-hidden="true">
                      {index + 1}
                    </span>
                    <LessonMeta lesson={lesson} locale={locale} copy={copy} />
                    {lesson.id !== primaryLesson?.id ? (
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
        </aside>
        <div className="group-main">
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

function LessonMeta({
  lesson,
  locale,
  copy,
  primary = false,
}: {
  lesson: LessonRecord
  locale: string
  copy: Copy
  primary?: boolean
}) {
  const status =
    lesson.status === 'live'
      ? copy.lessonLive
      : lesson.status === 'ended'
        ? copy.lessonEnded
        : lesson.status === 'cancelled'
          ? copy.lessonCancelled
          : copy.lessonScheduled
  return (
    <div className="group-lesson-meta">
      <time
        id={`${primary ? 'primary-' : ''}lesson-time-${lesson.id}`}
        dateTime={lesson.scheduledAt}
      >
        <strong>{formatLessonTime(lesson.scheduledAt, locale)}</strong>
      </time>
      <span className={`tag status-${lesson.status}`}>{status}</span>
    </div>
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
  copy: LessonActionsCopy
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirming])
  const post = (path: string) => {
    setConfirming(false)
    setBusy(true)
    void apiFetch(path, { method: 'POST', previewRole })
      .then(() => router.invalidate())
      .finally(() => setBusy(false))
  }
  if (!lesson.can.start && !lesson.can.end && !lesson.can.join) return null
  return (
    <LessonActions
      lesson={lesson}
      primary={primary}
      busy={busy}
      confirming={confirming}
      search={search}
      copy={copy}
      onStart={() => post(`/api/lessons/${lesson.id}/start`)}
      onArmEnd={() => setConfirming(true)}
      onConfirmEnd={() => post(`/api/lessons/${lesson.id}/end`)}
      onCancelEnd={() => setConfirming(false)}
    />
  )
}
