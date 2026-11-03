import { statusTone } from '../../../lib/tone'
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
  lessonMaterialsBody,
  nextGroupLesson,
  tashkentInputToIso,
  type MaterialsForm,
  type GroupRecord,
  type LessonRecord,
} from '../../../lib/classroom'
import { EnrolPanel } from '../../../components/enrol-panel'
import {
  AssignForm,
  AssignmentsList,
} from '../../../components/group-assignments'
import { LessonButtons } from '../../../components/lesson-buttons'
import {
  MaterialFields,
  MaterialsEditor,
} from '../../../components/lesson-materials'
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
    failed: copy.lessonActionFailed,
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
          <h1>{group.name}</h1>
          <p className="hint">
            {copy.members} {group.learnerCount}/{group.capacity}
          </p>
        </div>
        {group.can.createLesson ? (
          <ScheduleForm
            groupId={group.id}
            previewRole={previewRole}
            copy={copy}
          />
        ) : null}
      </div>
      <div className="group-layout">
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
        <aside className="group-lessons" aria-labelledby="group-lessons-title">
          <h2 id="group-lessons-title" tabIndex={-1}>
            {copy.groupLessons}
          </h2>
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
                    {lesson.can.editMaterials ? (
                      <MaterialsEditor
                        lesson={lesson}
                        previewRole={previewRole}
                        copy={copy}
                      />
                    ) : null}
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
      {lesson.topic ? (
        <span className="group-lesson-topic">{lesson.topic}</span>
      ) : null}
      <span
        className={`tag status-${lesson.status}`}
        data-tone={statusTone(lesson.status)}
      >
        {status}
      </span>
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
      <h2 id="members-title">{copy.members}</h2>
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
  copy: Copy
}) {
  const router = useRouter()
  const [scheduledAt, setScheduledAt] = useState('')
  const [materials, setMaterials] = useState<MaterialsForm>({
    topic: '',
    slideUrl: '',
    canvasUrl: '',
  })
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
          body: JSON.stringify({
            scheduledAt: iso,
            ...lessonMaterialsBody(materials),
          }),
        })
          .then(() => router.invalidate())
          .finally(() => setBusy(false))
      }}
    >
      <label>
        <span>{copy.lessonDateTime} (Asia/Tashkent)</span>
        <input
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
        />
      </label>
      <MaterialFields form={materials} onChange={setMaterials} copy={copy} />
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {copy.scheduleLesson}
      </button>
    </form>
  )
}
