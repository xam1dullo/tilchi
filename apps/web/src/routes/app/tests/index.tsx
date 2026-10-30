import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
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
  MAX_TITLE,
  type QuestionRecord,
  questionRowView,
  type RowConfirm,
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
  errorComponent: BankError,
})

type Filter = QuestionStatus | 'all'
type ErrorKey = keyof Copy
/** Which request is in flight, so only its own button says "Saving…". */
type Pending = 'question' | 'test' | 'row' | null

function BankError({ reset }: { reset: () => void }) {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div role="alert" className="error-row">
      <p>{copy.error}</p>
      <button type="button" className="btn btn-outline" onClick={reset}>
        {copy.retry}
      </button>
    </div>
  )
}

function TestsPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const { questions, tests } = Route.useLoaderData()
  const copy = messages(locale)
  const router = useRouter()
  const search = keepAppSearch(previewRole)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState(emptyDraft())
  const [editing, setEditing] = useState<QuestionRecord | null>(null)
  const [formErrors, setFormErrors] = useState<ErrorKey[]>([])
  const [listError, setListError] = useState<ErrorKey | null>(null)
  const [confirm, setConfirm] = useState<RowConfirm>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [attempt, setAttempt] = useState(0)
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [testErrs, setTestErrs] = useState<ErrorKey[]>([])
  const busy = pending !== null

  useEffect(() => {
    if (!editing) return
    promptRef.current?.focus({ preventScroll: true })
    promptRef.current?.scrollIntoView({ block: 'center' })
  }, [editing])

  /** Null on success, else the copy key of the failure. */
  async function send(
    kind: Exclude<Pending, null>,
    path: string,
    method: string,
    body?: object,
  ) {
    setPending(kind)
    setListError(null)
    setAttempt((n) => n + 1)
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
      setPending(null)
    }
  }

  function resetForm() {
    setEditing(null)
    setDraft(emptyDraft())
    setFormErrors([])
  }

  async function saveQuestion() {
    if (busy) return
    setListError(null)
    setAttempt((n) => n + 1)
    const errors = draftErrors(draft)
    setFormErrors(errors)
    if (errors.length) return
    if (editing) {
      const patch = toQuestionPatch(draft, editing)
      if (!patch) return resetForm()
      const failed = await send(
        'question',
        questionPath(editing.id),
        'PATCH',
        patch,
      )
      return failed ? setFormErrors([failed]) : resetForm()
    }
    const failed = await send(
      'question',
      '/api/questions',
      'POST',
      toQuestionBody(draft),
    )
    return failed ? setFormErrors([failed]) : resetForm()
  }

  async function act(q: QuestionRecord, action: 'publish' | 'delete') {
    if (busy) return
    const failed = await send(
      'row',
      questionPath(q.id),
      action === 'publish' ? 'PATCH' : 'DELETE',
      action === 'publish' ? { status: 'published' } : undefined,
    )
    if (failed) return setListError(failed)
    setConfirm(null)
    if (editing?.id === q.id) resetForm()
  }

  async function createTest() {
    if (busy) return
    setListError(null)
    setAttempt((n) => n + 1)
    const errors = testErrors(title, picked)
    setTestErrs(errors)
    if (errors.length) return
    const failed = await send(
      'test',
      '/api/tests',
      'POST',
      toTestBody(title, picked),
    )
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
          locked={busy}
          saving={pending === 'question'}
          errors={formErrors}
          attempt={attempt}
          promptRef={promptRef}
          onChange={setDraft}
          onSubmit={() => void saveQuestion()}
          onCancel={resetForm}
        />
        {listError ? (
          <p key={attempt} role="alert" className="notice" data-tone="error">
            {copy[listError]}
          </p>
        ) : null}
        {shown.length === 0 ? (
          <p className="hint">{copy.questionEmpty}</p>
        ) : (
          <ul className="rows question-list">
            {shown.map((q) => {
              const row = questionRowView(q, editing?.id ?? null, confirm)
              const hintId = `publish-hint-${q.id}`
              return (
                <li className="row question-row" key={q.id}>
                  <QuestionView copy={copy} question={q} />
                  <div className="lesson-actions">
                    {row.confirming ? (
                      <>
                        <span>
                          {row.confirming === 'publish'
                            ? copy.questionPublishPrompt
                            : copy.questionDeletePrompt}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={busy}
                          onClick={() =>
                            void act(q, row.confirming ?? 'delete')
                          }
                        >
                          {pending === 'row'
                            ? copy.courseSaving
                            : row.confirming === 'publish'
                              ? copy.questionPublishConfirm
                              : copy.courseDeleteConfirm}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={busy}
                          onClick={() => setConfirm(null)}
                        >
                          {copy.courseCancel}
                        </button>
                      </>
                    ) : (
                      <>
                        {row.edit ? (
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={busy}
                            onClick={() => {
                              setEditing(q)
                              setDraft(draftFromQuestion(q))
                              setFormErrors([])
                              setListError(null)
                              setConfirm(null)
                            }}
                          >
                            {copy.courseEdit}
                          </button>
                        ) : null}
                        {row.publish ? (
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={busy || row.publishBlocked}
                            aria-describedby={
                              row.publishBlocked ? hintId : undefined
                            }
                            onClick={() => {
                              setListError(null)
                              setConfirm({ id: q.id, action: 'publish' })
                            }}
                          >
                            {copy.questionPublish}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={busy}
                          onClick={() => {
                            setListError(null)
                            setConfirm({ id: q.id, action: 'delete' })
                          }}
                        >
                          {copy.courseDelete}
                        </button>
                        {row.publishBlocked ? (
                          <span id={hintId} className="hint">
                            {copy.questionPublishEditing}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
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
          <fieldset className="question-lock" disabled={busy}>
            <label>
              {copy.testTitle}
              <input
                value={title}
                maxLength={MAX_TITLE}
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
              <button className="btn btn-primary" type="submit">
                {pending === 'test' ? copy.courseSaving : copy.testCreate}
              </button>
            </div>
          </fieldset>
          {testErrs.map((key) => (
            <p
              key={`${attempt}-${key}`}
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
