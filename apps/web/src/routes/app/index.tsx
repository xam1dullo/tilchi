import { CabinetStats } from '../../components/cabinet-stats'
import { HomeDueTests, HomeLead } from '../../components/home-lead'
import { homeView } from '../../lib/home'
import type { MyAssignment } from '../../lib/attempt'
import { groupStats } from '../../lib/cabinet'
import { loadForSession, sessionData } from '../../lib/session'
import { botLink, tgLinkProps } from '@tilchi/content'
import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { apiFetch } from '../../lib/api'
import {
  createGroupBody,
  createGroupError,
  formatLessonTime,
  groupsView,
  type CreateGroupForm,
  type GroupRecord,
  type LessonRecord,
  type Teacher,
} from '../../lib/classroom'
import { CreateGroupFormView } from '../../components/create-group-form'
import { messages, type Copy } from '../../lib/i18n'
import { keepAppSearch } from '../../lib/preview'

export const Route = createFileRoute('/app/')({
  loader: ({ context }) =>
    loadForSession(context.session, async () => {
      const { previewRole } = context
      const list = await apiFetch<{
        groups: GroupRecord[]
        can: { createGroup: boolean; assignTeacher: boolean }
      }>('/api/groups', { previewRole })
      const role = context.session?.role
      // One small call per group; a group whose lessons cannot be read
      // (or are not loaded yet) simply shows no next lesson.
      // ponytail: an admin sees every group, so past 10 the fan-out is
      // skipped; move "next lesson" into /api/groups when that bites.
      const lessonGroups =
        role === 'admin' && list.groups.length > 10 ? [] : list.groups
      const [{ teachers }, lessonLists, { assignments }] = await Promise.all([
        list.can.assignTeacher
          ? apiFetch<{ teachers: Teacher[] }>('/api/teachers', { previewRole })
          : { teachers: [] as Teacher[] },
        Promise.all(
          lessonGroups.map((group) =>
            apiFetch<{ lessons: LessonRecord[] }>(
              `/api/groups/${group.id}/lessons`,
              { previewRole },
            )
              .then((r) => [group.id, r.lessons] as const)
              .catch(() => [group.id, [] as LessonRecord[]] as const),
          ),
        ),
        role === 'learner'
          ? apiFetch<{ assignments: MyAssignment[] }>('/api/me/assignments', {
              previewRole,
            }).catch(() => ({ assignments: [] as MyAssignment[] }))
          : { assignments: [] as MyAssignment[] },
      ])
      return {
        ...list,
        teachers,
        lessonsByGroup: Object.fromEntries(lessonLists),
        assignments,
        now: Date.now(),
      }
    }),
  component: GroupsPage,
})

function GroupsPage() {
  const { locale, botUsername } = useRouteContext({ from: '__root__' })
  const { previewRole, session } = useRouteContext({ from: '/app' })
  const { groups, can, teachers, lessonsByGroup, assignments, now } =
    sessionData(Route.useLoaderData())
  const copy = messages(locale)
  const view = groupsView({ groups, can })
  const home = homeView({ groups, lessonsByGroup, assignments, now })
  const role = session?.role ?? 'learner'
  const search = keepAppSearch(previewRole)
  return (
    <section className="classroom groups-page">
      <div className="classroom-head">
        <div>
          {view.empty ? <p className="eyebrow">{copy.groups}</p> : null}
          <h1>{view.empty ? copy.emptyTitle : copy.groups}</h1>
        </div>
        {view.canCreate ? (
          <CreateGroup
            previewRole={previewRole}
            copy={copy}
            assignTeacher={can.assignTeacher}
            teachers={teachers}
          />
        ) : null}
      </div>
      {view.empty ? (
        <EmptyGroups copy={copy} botUsername={botUsername} />
      ) : (
        <>
          <HomeLead
            next={home.next}
            copy={copy}
            locale={locale}
            search={search}
          />
          <HomeDueTests
            tests={home.dueTests}
            more={home.moreTests}
            copy={copy}
            locale={locale}
            search={search}
          />
          {role === 'learner' ? null : (
            <CabinetStats items={groupStats(groups, copy, role)} />
          )}
          <h2 className="sr-only">{copy.groups}</h2>
          <ul className="rows classroom-list">
            {home.groups.map(({ group, nextLesson }) => (
              <li key={group.id} className="row classroom-row">
                <Link
                  to="/app/groups/$groupId"
                  params={{ groupId: group.id }}
                  search={search}
                >
                  <strong>{group.name}</strong>
                  <span>
                    {role === 'learner'
                      ? null
                      : `${copy.members} ${group.learnerCount}/${group.capacity} · `}
                    {nextLesson
                      ? formatLessonTime(nextLesson.scheduledAt, locale)
                      : copy.homeGroupNoLesson}
                  </span>
                  <span className="cabinet-action">
                    {copy.cabinetOpen} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** The course catalog route does not exist yet: this goes to the landing section. */
export function EmptyGroups({
  copy,
  botUsername = 'tilchiuz_bot',
}: {
  copy: Copy
  botUsername?: string | null
}) {
  return (
    <div className="empty-panel">
      <p>{copy.emptyBody}</p>
      <div className="panel-actions">
        <a className="btn btn-primary" href="/courses">
          {copy.catalog}
        </a>
        {botUsername && (
          <a
            className="btn btn-outline"
            {...tgLinkProps(botLink('', '', botUsername))}
          >
            {copy.telegramWrite}
          </a>
        )}
      </div>
    </div>
  )
}

function CreateGroup({
  previewRole,
  copy,
  assignTeacher,
  teachers,
}: {
  previewRole: 'learner' | 'teacher' | 'admin' | null
  copy: Copy
  assignTeacher: boolean
  teachers: Teacher[]
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReturnType<
    typeof createGroupError
  > | null>(null)
  const form: CreateGroupForm = {
    name,
    teacherId,
    assignTeacher,
    teachers,
    busy,
  }
  return (
    <CreateGroupFormView
      copy={copy}
      form={form}
      error={error}
      onName={setName}
      onTeacher={setTeacherId}
      onSubmit={() => {
        setBusy(true)
        setError(null)
        void apiFetch('/api/groups', {
          method: 'POST',
          previewRole,
          body: JSON.stringify(createGroupBody(form)),
        })
          .then(() => {
            setName('')
            return router.invalidate()
          })
          .catch((caught: unknown) => setError(createGroupError(caught)))
          .finally(() => setBusy(false))
      }}
    />
  )
}
