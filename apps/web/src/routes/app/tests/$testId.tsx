import { loadForSession } from '../../../lib/session'
import { RetryButton } from '../../../components/retry-button'
import { Link, createFileRoute, useRouteContext } from '@tanstack/react-router'
import { apiFetch } from '../../../lib/api'
import { messages } from '../../../lib/i18n'
import { keepAppSearch } from '../../../lib/preview'
import { type TestRecord, testLoadError } from '../../../lib/question-form'
import {
  QuestionView,
  requireManageTests,
} from '../../../components/question-form'

export const Route = createFileRoute('/app/tests/$testId')({
  loader: ({ context: { previewRole, session }, params }) =>
    loadForSession(session, async () => {
      await requireManageTests(previewRole)
      return apiFetch<TestRecord>(
        `/api/tests/${encodeURIComponent(params.testId)}`,
        { previewRole },
      )
    }),
  component: TestPage,
  errorComponent: TestError,
})

function TestError({ error }: { error: unknown }) {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const copy = messages(locale)
  const key = testLoadError(error)
  return (
    <div role="alert" className="error-row">
      <p>{copy[key]}</p>
      {key === 'testNotFound' ? (
        <Link
          className="btn btn-outline"
          to="/app/tests"
          search={keepAppSearch(previewRole)}
        >
          {copy.tests}
        </Link>
      ) : (
        <RetryButton label={copy.retry} />
      )}
    </div>
  )
}

function TestPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  // biome-ignore lint/style/noNonNullAssertion: AppLayout only renders children with a session.
  const test = Route.useLoaderData()!
  const copy = messages(locale)
  return (
    <section className="classroom" aria-labelledby="test-heading">
      <p className="eyebrow">
        <Link to="/app/tests" search={keepAppSearch(previewRole)}>
          {copy.tests}
        </Link>
      </p>
      <div className="classroom-head">
        <div>
          <h2 id="test-heading">{test.title}</h2>
          <p className="hint">
            {copy.testQuestionCount} {test.questions.length} ·{' '}
            {copy.testMaxScore} <span className="num">{test.maxScore}</span>
          </p>
        </div>
      </div>
      <ol className="rows question-list">
        {test.questions.map((q) => (
          <li className="row question-row" key={q.id}>
            <QuestionView copy={copy} question={q} />
          </li>
        ))}
      </ol>
    </section>
  )
}
