import { CabinetStats, CabinetIcon } from '../../../components/cabinet-stats'
import { testStats } from '../../../lib/cabinet'
import { loadForSession, sessionData } from '../../../lib/session'
import { RetryButton } from '../../../components/retry-button'
import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  Collapsible,
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
  type CloseFocus,
  focusAfterClose,
  type FormState,
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
  loader: ({ context: { previewRole, session } }) =>
    loadForSession(session, async () => {
      await requireManageTests(previewRole)
      const [bank, list] = await Promise.all([
        apiFetch<{ questions: QuestionRecord[] }>('/api/questions', {
          previewRole,
        }),
        apiFetch<{ tests: TestSummary[] }>('/api/tests', { previewRole }),
      ])
      return { questions: bank.questions, tests: list.tests }
    }),
  component: TestsPage,
  errorComponent: BankError,
})

type Filter = QuestionStatus | 'all'
type ErrorKey = keyof Copy
/** Which request is in flight, so only its own button says "Saving…". */
type Pending = 'question' | 'test' | 'row' | null

function BankError() {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div role="alert" className="error-row">
      <p>{copy.error}</p>
      <RetryButton label={copy.retry} />
    </div>
  )
}

function TestsPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const { questions, tests } = sessionData(Route.useLoaderData())
  const copy = messages(locale)
  const router = useRouter()
  const search = keepAppSearch(previewRole)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState(emptyDraft())
  const [editing, setEditing] = useState<QuestionRecord | null>(null)
  const [adding, setAdding] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<ErrorKey[]>([])
  const [listError, setListError] = useState<ErrorKey | null>(null)
  const [confirm, setConfirm] = useState<RowConfirm>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [attempt, setAttempt] = useState(0)
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [testErrs, setTestErrs] = useState<ErrorKey[]>([])
  const busy = pending !== null
  const questionOpen = adding || editing !== null

  // biome-ignore lint/correctness/useExhaustiveDependencies: editing another row while open moves focus to it too
  useEffect(() => {
    if (!questionOpen) return
    promptRef.current?.focus({ preventScroll: true })
    promptRef.current?.scrollIntoView({ block: 'center' })
  }, [questionOpen, editing])

  useEffect(() => {
    if (testOpen) titleRef.current?.focus()
  }, [testOpen])

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
    setAdding(false)
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
    // A deleted question can no longer be picked, nor unticked once hidden.
    if (action === 'delete') setPicked((ids) => ids.filter((id) => id !== q.id))
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
    closeTest()
  }

  function closeTest() {
    setTestOpen(false)
    setTitle('')
    setPicked([])
    setTestErrs([])
  }

  const published = questions.filter((q) => q.status === 'published')
  const shown = filterQuestions(questions, filter)

  const questionBefore = useRef<FormState>({ open: false, editId: null })
  const testBefore = useRef<FormState>({ open: false, editId: null })
  const editId = editing?.id ?? null
  const shownIds = shown.map((q) => q.id).join(' ')
  useEffect(() => {
    const target = focusAfterClose(
      questionBefore.current,
      questionOpen,
      shownIds.split(' '),
    )
    questionBefore.current = { open: questionOpen, editId }
    returnFocus(target, NEW_QUESTION_ID)
  }, [questionOpen, editId, shownIds])
  useEffect(() => {
    const target = focusAfterClose(testBefore.current, testOpen, [])
    testBefore.current = { open: testOpen, editId: null }
    returnFocus(target, NEW_TEST_ID)
  }, [testOpen])

  return (
    <section className="classroom tests-page" aria-labelledby="tests-heading">
      <h2 id="tests-heading" className="tests-title">
        {copy.tests}
      </h2>
      <CabinetStats items={testStats(tests, questions, copy)} />
      <div className="tests-grid">
        <section className="tests-section" aria-labelledby="bank-heading">
          <h3 id="bank-heading">{copy.questionBank}</h3>
          <Collapsible
            open={questionOpen}
            label={copy.questionNew}
            buttonId={NEW_QUESTION_ID}
            primary
            onOpen={() => {
              setConfirm(null)
              setListError(null)
              setAdding(true)
            }}
          >
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
          </Collapsible>
          <div className="tests-toolbar">
            <label className="classroom-form question-filter">
              {copy.questionFilter}
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
              >
                <option value="all">{copy.questionFilterAll}</option>
                <option value="draft">{copy.questionFilterDraft}</option>
                <option value="published">
                  {copy.questionFilterPublished}
                </option>
              </select>
            </label>
          </div>
          {listError ? (
            <p key={attempt} role="alert" className="notice" data-tone="error">
              {copy[listError]}
            </p>
          ) : null}
          {shown.length === 0 ? (
            <p className="hint">{copy.questionEmpty}</p>
          ) : (
            <ul className="rows question-list">
              {shown.map((q, index) => {
                const row = questionRowView(q, editing?.id ?? null, confirm)
                const hintId = `publish-hint-${q.id}`
                return (
                  <li className="row question-row" key={q.id}>
                    <span className="question-index num" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
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
                              id={editButtonId(q.id)}
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

        <section className="tests-section" aria-labelledby="tests-list-heading">
          <h3 id="tests-list-heading">{copy.tests}</h3>
          <Collapsible
            open={testOpen}
            label={copy.testNew}
            buttonId={NEW_TEST_ID}
            onOpen={() => setTestOpen(true)}
          >
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
                    ref={titleRef}
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
                              onChange={() =>
                                setPicked(togglePick(picked, q.id))
                              }
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
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={closeTest}
                  >
                    {copy.courseCancel}
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
          </Collapsible>
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
                    <CabinetIcon />
                    <strong>{test.title}</strong>
                    <span className="num">
                      {copy.testQuestionCount} {test.questionCount}
                    </span>
                    <span className="cabinet-action">
                      {copy.cabinetOpen} <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}

const questionPath = (id: string) => `/api/questions/${encodeURIComponent(id)}`

const NEW_QUESTION_ID = 'new-question'
const NEW_TEST_ID = 'new-test'
const editButtonId = (id: string) => `edit-question-${id}`

/** Edit row's button when it can take focus, else the New button. */
function returnFocus(target: CloseFocus, newId: string) {
  if (!target) return
  const edit =
    target === 'new' ? null : document.getElementById(editButtonId(target.edit))
  const usable = edit instanceof HTMLButtonElement && !edit.disabled
  ;(usable ? edit : document.getElementById(newId))?.focus()
}
