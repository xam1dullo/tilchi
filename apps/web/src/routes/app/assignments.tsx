import { loadForSession } from '../../lib/session'
import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { MyTestsList } from '../../components/my-tests'
import { RetryButton } from '../../components/retry-button'
import { apiFetch } from '../../lib/api'
import type { MyAssignment } from '../../lib/attempt'
import { messages } from '../../lib/i18n'

export const Route = createFileRoute('/app/assignments')({
  loader: ({ context: { previewRole, session } }) =>
    loadForSession(session, () =>
      apiFetch<{ assignments: MyAssignment[] }>('/api/me/assignments', {
        previewRole,
      }),
    ),
  component: MyTestsPage,
  errorComponent: MyTestsError,
})

function MyTestsError() {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div role="alert" className="error-row">
      <p>{copy.error}</p>
      <RetryButton label={copy.retry} />
    </div>
  )
}

function MyTestsPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  // biome-ignore lint/style/noNonNullAssertion: AppLayout only renders children with a session.
  const { assignments } = Route.useLoaderData()!
  const copy = messages(locale)
  return (
    <section className="classroom" aria-labelledby="my-tests-heading">
      <h2 id="my-tests-heading">{copy.myTests}</h2>
      <MyTestsList
        assignments={assignments}
        copy={copy}
        locale={locale}
        previewRole={previewRole}
      />
    </section>
  )
}
