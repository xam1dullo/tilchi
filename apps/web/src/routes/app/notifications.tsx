import { loadForSession } from '../../lib/session'
import {
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { NotificationList, type Inbox } from '../../components/notifications'
import { apiFetch } from '../../lib/api'
import { messages } from '../../lib/i18n'

export const Route = createFileRoute('/app/notifications')({
  loader: ({ context }) =>
    loadForSession(context.session, () =>
      apiFetch<Inbox>('/api/notifications', {
        previewRole: context.previewRole,
      }),
    ),
  component: NotificationsPage,
  errorComponent: NotificationsError,
})

function NotificationsError({ reset }: { reset: () => void }) {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div className="row error-row" role="alert">
      <p>{copy.error}</p>
      <button className="btn btn-outline" type="button" onClick={reset}>
        {copy.retry}
      </button>
    </div>
  )
}

function NotificationsPage() {
  const inbox = Route.useLoaderData()
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  async function markRead(id: string) {
    if (busyId !== null) return
    setBusyId(id)
    setError(false)
    try {
      await apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        previewRole,
      })
      await router.invalidate()
      titleRef.current?.focus()
    } catch {
      setError(true)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <NotificationList
      inbox={inbox}
      copy={messages(locale)}
      locale={locale}
      previewRole={previewRole}
      busyId={busyId}
      error={error}
      onRead={(id) => void markRead(id)}
      titleRef={titleRef}
    />
  )
}
