import {
  Link,
  createFileRoute,
  useNavigate,
  useRouteContext,
} from '@tanstack/react-router'
import { MeetEntry } from '../../../components/meet/meet-room'
import { apiFetch } from '../../../lib/api'
import type { GroupRecord, LessonRecord } from '../../../lib/classroom'
import { messages } from '../../../lib/i18n'
import { keepAppSearch } from '../../../lib/preview'

type LessonBody = {
  lesson: LessonRecord
  group: GroupRecord
  meeting: { id: string; livekitRoom: string } | null
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
  const navigate = useNavigate()
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
      <MeetEntry
        key={lessonId}
        status={lesson.status}
        lessonId={lessonId}
        previewRole={previewRole}
        copy={copy}
        onLeave={() => {
          void navigate({ to: '/app', search })
        }}
      />
    </section>
  )
}
