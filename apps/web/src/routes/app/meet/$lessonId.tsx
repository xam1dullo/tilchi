import { loadForSession } from '../../../lib/session'
import { Suspense, lazy } from 'react'
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

// Own chunk: the helper must not add to the initial JS of / and /app.
const AiHelper = lazy(() => import('../../../components/ai/ai-helper'))

export const Route = createFileRoute('/app/meet/$lessonId')({
  loader: ({ context, params }) =>
    loadForSession(context.session, async () => {
      return apiFetch<LessonBody>(`/api/lessons/${params.lessonId}`, {
        previewRole: context.previewRole,
      })
    }),
  component: MeetPage,
})

function MeetPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  // biome-ignore lint/style/noNonNullAssertion: AppLayout only renders children with a session.
  const { lesson, group } = Route.useLoaderData()!
  const { lessonId } = Route.useParams()
  const navigate = useNavigate()
  const copy = messages(locale)
  const search = keepAppSearch(previewRole)
  return (
    <section className="meet-page" aria-labelledby="meet-title">
      <p className="meet-back">
        <Link
          className="back-link"
          to="/app/groups/$groupId"
          params={{ groupId: group.id }}
          search={search}
        >
          <span aria-hidden="true">←</span> {copy.backToGroup}
        </Link>
      </p>
      <h2 id="meet-title">{copy.meetTitle}</h2>
      <p className="hint">{group.name}</p>
      <div className="meet-tools">
        <Suspense fallback={null}>
          <AiHelper
            lessonId={lessonId}
            previewRole={previewRole}
            locale={locale}
          />
        </Suspense>
      </div>
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
