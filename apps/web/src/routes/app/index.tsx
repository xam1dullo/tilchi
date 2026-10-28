import { botLink, tgLinkProps } from '@tilchi/content'
import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { apiFetch } from '../../lib/api'
import { groupsView, type GroupRecord } from '../../lib/classroom'
import { messages } from '../../lib/i18n'
import { keepAppSearch } from '../../lib/preview'

export const Route = createFileRoute('/app/')({
  loader: async ({ context }) => {
    const body = await apiFetch<{ groups: GroupRecord[] }>('/api/groups', {
      previewRole: context.previewRole,
    })
    return { groups: body.groups }
  },
  component: GroupsPage,
})

function GroupsPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { session, previewRole } = useRouteContext({ from: '/app' })
  const { groups } = Route.useLoaderData()
  const copy = messages(locale)
  const view = groupsView({
    role: session?.role ?? 'learner',
    groups,
  })
  const search = keepAppSearch(previewRole)
  return (
    <section className="classroom">
      <div className="classroom-head">
        <div>
          <p className="eyebrow">{copy.groups}</p>
          <h2>{view.empty ? copy.emptyTitle : copy.groups}</h2>
        </div>
        {view.canCreate ? (
          <CreateGroupForm previewRole={previewRole} label={copy.createGroup} />
        ) : null}
      </div>
      {view.empty ? (
        <div className="empty-panel">
          <p>{copy.emptyBody}</p>
          <div className="panel-actions">
            <a className="btn btn-primary" href="/">
              {copy.catalog}
            </a>
            <a className="btn btn-outline" {...tgLinkProps(botLink('', ''))}>
              {copy.telegramWrite}
            </a>
          </div>
        </div>
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
                  {copy.members} {group.memberIds.length}/{group.capacity}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CreateGroupForm({
  previewRole,
  label,
}: {
  previewRole: 'learner' | 'teacher' | 'admin' | null
  label: string
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="classroom-form"
      onSubmit={(event) => {
        event.preventDefault()
        setBusy(true)
        void apiFetch('/api/groups', {
          method: 'POST',
          previewRole,
          body: JSON.stringify({ name }),
        })
          .then(() => router.invalidate())
          .finally(() => setBusy(false))
      }}
    >
      <label>
        <span className="sr-only">{label}</span>
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={label}
          required
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {label}
      </button>
    </form>
  )
}
