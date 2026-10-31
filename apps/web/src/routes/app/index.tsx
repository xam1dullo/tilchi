import { loadForSession } from '../../lib/session'
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
  groupsView,
  type CreateGroupForm,
  type GroupRecord,
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
      const { teachers } = list.can.assignTeacher
        ? await apiFetch<{ teachers: Teacher[] }>('/api/teachers', {
            previewRole,
          })
        : { teachers: [] }
      return { ...list, teachers }
    }),
  component: GroupsPage,
})

function GroupsPage() {
  const { locale, botUsername } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const { groups, can, teachers } = Route.useLoaderData()
  const copy = messages(locale)
  const view = groupsView({ groups, can })
  const search = keepAppSearch(previewRole)
  return (
    <section className="classroom">
      <div className="classroom-head">
        <div>
          <p className="eyebrow">{copy.groups}</p>
          <h2>{view.empty ? copy.emptyTitle : copy.groups}</h2>
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
        <ul className="rows classroom-list">
          {view.groups.map((group) => (
            <li key={group.id} className="row classroom-row">
              <Link
                to="/app/groups/$groupId"
                params={{ groupId: group.id }}
                search={search}
              >
                <strong>{group.name}</strong>
                <span>
                  {copy.members} {group.learnerCount}/{group.capacity}
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
