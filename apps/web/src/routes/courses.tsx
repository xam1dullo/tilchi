import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { PublicCatalog } from '../components/public-catalog'
import { apiFetch } from '../lib/api'
import type { CourseRecord } from '../lib/catalog'
import { messages } from '../lib/i18n'

export const Route = createFileRoute('/courses')({
  loader: () => apiFetch<{ courses: CourseRecord[] }>('/api/courses'),
  component: CoursesPage,
  errorComponent: CoursesError,
  pendingComponent: CoursesPending,
})

function CoursesPage() {
  const { locale, botUsername } = useRouteContext({ from: '__root__' })
  const { courses } = Route.useLoaderData()
  return (
    <PublicCatalog
      courses={courses}
      botUsername={botUsername}
      copy={messages(locale)}
    />
  )
}

function CoursesPending() {
  const { locale } = useRouteContext({ from: '__root__' })
  return (
    <div className="l-page" aria-busy="true" role="status">
      {messages(locale).catalogLoading}
    </div>
  )
}

function CoursesError({ reset }: { reset: () => void }) {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div className="l-page error-row" role="alert">
      <p>{copy.catalogError}</p>
      <button className="btn btn-outline" type="button" onClick={reset}>
        {copy.retry}
      </button>
    </div>
  )
}
