import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import {
  QuestionForm,
  QuestionView,
  requireManageTests,
} from '../../../components/question-form'
import { apiFetch } from '../../../lib/api'
import { type Copy, messages } from '../../../lib/i18n'
import { keepAppSearch } from '../../../lib/preview'
import {
  bankError,
  draftErrors,
  draftFromQuestion,
  emptyDraft,
  filterQuestions,
  type QuestionRecord,
  type QuestionStatus,
  testErrors,
  type TestSummary,
  toQuestionBody,
  toQuestionPatch,
  toTestBody,
  togglePick,
} from '../../../lib/question-form'

export const Route = createFileRoute('/app/tests/')({
  loader: async ({ context: { previewRole } }) => {
    await requireManageTests(previewRole)
    const [bank, list] = await Promise.all([
      apiFetch<{ questions: QuestionRecord[] }>('/api/questions', {
        previewRole,
      }),
      apiFetch<{ tests: TestSummary[] }>('/api/tests', { previewRole }),
    ])
    return { questions: bank.questions, tests: list.tests }
  },
  component: TestsPage,
})

type Filter = QuestionStatus | 'all'
type ErrorKey = keyof Copy

function TestsPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const { questions, tests } = Route.useLoaderData()
  const copy = messages(locale)
  const router = useRouter()
  const search = keepAppSearch(previewRole)

  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState(emptyDraft())
  const [editing, setEditing] = useState<QuestionRecord | null>(null)
  const [formErrors, setFormErrors] = useState<ErrorKey[]>([])
  const [listError, setListError] = useState<ErrorKey | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [testErrs, setTestErrs] = useState<ErrorKey[]>([])

  /** Null on success, else the copy key of the failure. */
  async function send(path: string, method: string, body?: object) {
    setBusy(true)
    try {
      await apiFetch(path, {
        method,
        previewRole,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      await router.invalidate()
      return null
    } catch (error) {
      return bankError(error)
    } finally {
      setBusy(false)
    }
  }

  function resetForm() {
    setEditing(null)
    setDraft(emptyDraft())
    setFormErrors([])
  }

  async function saveQuestion() {
    if (busy) return
    const errors = draftErrors(draft)
    setFormErrors(errors)
    if (errors.length) return
    if (editing) {
      const patch = toQuestionPatch(draft, editing)
      if (!patch) return resetForm()
      const failed = await send(questionPath(editing.id), 'PATCH', patch)
      return failed ? setFormErrors([failed]) : resetForm()
    }
    const failed = await send('/api/questions', 'POST', toQuestionBody(draft))
    return failed ? setFormErrors([failed]) : resetForm()
  }

  async function act(q: QuestionRecord, method: 'PATCH' | 'DELETE') {
    if (busy) return
    setListError(null)
    const failed = await send(
      questionPath(q.id),
      method,
      method === 'PATCH' ? { status: 'published' } : undefined,
    )
    if (failed) return setListError(failed)
    setConfirmId(null)
    if (editing?.id === q.id) resetForm()
  }

  async function createTest() {
    if (busy) return
    const errors = testErrors(title, picked)
    setTestErrs(errors)
    if (errors.length) return
    const failed = await send('/api/tests', 'POST', toTestBody(title, picked))
    if (failed) return setTestErrs([failed])
    setTitle('')
    setPicked([])
  }

  const published = questions.filter((q) => q.status === 'published')
  const shown = filterQuestions(questions, filter)

  return (
    <section className="classroom" aria-labelledby="tests-heading">
      <h2 id="tests-heading">{copy.tests}</h2>

      <section aria-labelledby="bank-heading">
        <div className="classroom-head">
          <h3 id="bank-heading">{copy.questionBank}</h3>
          <label className="classroom-form question-filter">
            {copy.questionFilter}
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
            >
              <option value="all">{copy.questionFilterAll}</option>
              <option value="draft">{copy.courseDraft}</option>
              <option value="published">{copy.coursePublished}</option>
            </select>
          </label>
        </div>
        <QuestionForm
          copy={copy}
          draft={draft}
          editing={editing !== null}
          busy={busy}
          errors={formErrors}
          onChange={setDraft}
          onSubmit={() => void saveQuestion()}
          onCancel={resetForm}
        />
        {listError ? (
          <p role="alert" className="notice" data-tone="error">
            {copy[listError]}
          </p>
        ) : null}
        {shown.length === 0 ? (
          <p className="hint">{copy.questionEmpty}</p>
        ) : (
          <ul className="rows question-list">
            {shown.map((q) => (
              <li className="row question-row" key={q.id}>
                <QuestionView copy={copy} question={q} />
                {q.status === 'draft' ? (
                  <div className="lesson-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={() => {
                        setEditing(q)
                        setDraft(draftFromQuestion(q))
                        setFormErrors([])
                        setConfirmId(null)
                      }}
                    >
                      {copy.courseEdit}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={() => void act(q, 'PATCH')}
                    >
                      {copy.questionPublish}
                    </button>
                    {confirmId === q.id ? (
                      <>
                        <span>{copy.questionDeletePrompt}</span>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={busy}
                          onClick={() => void act(q, 'DELETE')}
                        >
                          {copy.courseDeleteConfirm}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={busy}
                          onClick={() => setConfirmId(null)}
                        >
                          {copy.courseCancel}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() => setConfirmId(q.id)}
                      >
                        {copy.courseDelete}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tests-list-heading">
        <h3 id="tests-list-heading">{copy.tests}</h3>
        <form
          className="classroom-form catalog-form question-form"
          aria-label={copy.testNew}
          onSubmit={(event) => {
            event.preventDefault()
            void createTest()
          }}
        >
          <label>
            {copy.testTitle}
            <input
              value={title}
              maxLength={120}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <fieldset className="question-wide question-options">
            <legend>{copy.testPick}</legend>
            {published.length === 0 ? (
              <p className="hint">{copy.testNoPublished}</p>
            ) : (
              <>
                <p className="hint">{copy.testPickHint}</p>
                {published.map((q) => {
                  const position = picked.indexOf(q.id)
                  return (
                    <label className="catalog-publish" key={q.id}>
                      <input
                        type="checkbox"
                        checked={position >= 0}
                        onChange={() => setPicked(togglePick(picked, q.id))}
                      />{' '}
                      {position >= 0 ? (
                        <span className="num">{position + 1}.</span>
                      ) : null}{' '}
                      {q.prompt}
                    </label>
                  )
                })}
              </>
            )}
          </fieldset>
          <div className="lesson-actions question-wide">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? copy.courseSaving : copy.testCreate}
            </button>
          </div>
          {testErrs.map((key) => (
            <p
              key={key}
              className="notice question-wide"
              data-tone="error"
              role="alert"
            >
              {copy[key]}
            </p>
          ))}
        </form>
        {tests.length === 0 ? (
          <p className="hint">{copy.testEmpty}</p>
        ) : (
          <ul className="rows classroom-list">
            {tests.map((test) => (
              <li key={test.id} className="row classroom-row">
                <Link
                  to="/app/tests/$testId"
                  params={{ testId: test.id }}
                  search={search}
                >
                  <strong>{test.title}</strong>
                  <span>
                    {copy.testQuestionCount} {test.questionCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

const questionPath = (id: string) => `/api/questions/${encodeURIComponent(id)}`
