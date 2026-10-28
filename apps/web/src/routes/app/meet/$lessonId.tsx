import { Link, createFileRoute, useRouteContext } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../../../lib/api'
import type { GroupRecord, LessonRecord } from '../../../lib/classroom'
import { messages } from '../../../lib/i18n'
import type { AppRole } from '../../../lib/nav'
import { keepAppSearch } from '../../../lib/preview'

type LessonBody = {
  lesson: LessonRecord
  group: GroupRecord
  meeting: { id: string; livekitRoom: string } | null
}

type TokenBody = {
  token: string
  room: string
  expiresInSeconds: number
}

export const Route = createFileRoute('/app/meet/$lessonId')({
  loader: async ({ context, params }) => {
    return apiFetch<LessonBody>(`/api/lessons/${params.lessonId}`, {
      previewRole: context.previewRole,
    })
  },
  component: MeetPage,
})

function MeetPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const { lesson, group } = Route.useLoaderData()
  const { lessonId } = Route.useParams()
  const copy = messages(locale)
  const search = keepAppSearch(previewRole)
  return (
    <section className="meet-page">
      <p className="eyebrow">
        <Link
          to="/app/groups/$groupId"
          params={{ groupId: group.id }}
          search={search}
        >
          {copy.backToGroup}
        </Link>
      </p>
      <h2>{copy.meetTitle}</h2>
      <p className="hint">{group.name}</p>
      {lesson.status === 'live' ? (
        <MeetJoin
          lessonId={lessonId}
          previewRole={previewRole}
          search={search}
          copy={copy}
        />
      ) : (
        <p className="empty-panel">{copy.meetWaiting}</p>
      )}
    </section>
  )
}

function MeetJoin({
  lessonId,
  previewRole,
  search,
  copy,
}: {
  lessonId: string
  previewRole: AppRole | null
  search: ReturnType<typeof keepAppSearch>
  copy: {
    meetUnavailable: string
    leaveMeet: string
    error: string
  }
}) {
  const [note, setNote] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let closed = false
    let disconnect: (() => void) | undefined
    void (async () => {
      try {
        const issued = await apiFetch<TokenBody>(
          `/api/meet/lessons/${lessonId}/token`,
          { method: 'POST', previewRole },
        )
        if (closed) return
        setRoomName(issued.room)
        const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
        const { Room } = await import('livekit-client')
        const room = new Room()
        await room.connect(url, issued.token)
        if (closed) {
          room.disconnect()
          return
        }
        disconnect = () => room.disconnect()
        setConnected(true)
      } catch (error) {
        if (closed) return
        if (error instanceof ApiError) {
          const body = error.body as { note?: string; error?: string }
          setNote(body.note ?? body.error ?? copy.meetUnavailable)
          return
        }
        setNote(copy.error)
      }
    })()
    return () => {
      closed = true
      disconnect?.()
    }
  }, [copy.error, copy.meetUnavailable, lessonId, previewRole])

  return (
    <div className="meet-stage">
      <p className="tag">{roomName ?? copy.meetUnavailable}</p>
      {note ? <p className="hint">{note}</p> : null}
      {connected ? (
        <Link className="btn btn-outline" to="/app" search={search}>
          {copy.leaveMeet}
        </Link>
      ) : null}
    </div>
  )
}
