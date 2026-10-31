import { loadForSession } from '../../lib/session'
import { RetryButton } from '../../components/retry-button'
import {
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { apiFetch } from '../../lib/api'
import type {
  CourseRecord,
  CourseSegment,
  CourseLevel,
} from '../../lib/catalog'
import { messages } from '../../lib/i18n'

export function courseFormData(form: FormData) {
  const title = String(form.get('title') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const segment = String(form.get('segment'))
  const level = String(form.get('level'))
  if (
    !title ||
    title.length > 120 ||
    !description ||
    description.length > 2000 ||
    !['bolalar', 'ielts', 'kattalar'].includes(segment) ||
    !['boshlovchi', 'orta', 'bilmayman'].includes(level)
  )
    return null
  return {
    title,
    description,
    segment: segment as CourseSegment,
    level: level as CourseLevel,
    published: form.has('published'),
  }
}

export const Route = createFileRoute('/app/courses')({
  loader: ({ context }) =>
    loadForSession(context.session, async () => {
      if (context.session?.role !== 'admin')
        return { courses: [] as CourseRecord[] }
      return apiFetch<{ courses: CourseRecord[] }>('/api/courses/manage', {
        previewRole: context.previewRole,
      })
    }),
  component: CoursesPage,
  errorComponent: CourseError,
})

function CourseError() {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div role="alert" className="error-row">
      <p>{copy.catalogError}</p>
      <RetryButton label={copy.retry} />
    </div>
  )
}

function CoursesPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { session, previewRole } = useRouteContext({ from: '/app' })
  const { courses } = Route.useLoaderData()
  const copy = messages(locale)
  const router = useRouter()
  const [editing, setEditing] = useState<CourseRecord | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [formKey, setFormKey] = useState(0)

  async function mutate(path: string, method: string, body?: object) {
    if (busy) return false
    setBusy(true)
    setError(false)
    try {
      await apiFetch(path, {
        method,
        previewRole,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      await router.invalidate()
      return true
    } catch {
      setError(true)
      return false
    } finally {
      setBusy(false)
    }
  }

  function clearForm() {
    setEditing(null)
    setFormKey((value) => value + 1)
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = courseFormData(new FormData(event.currentTarget))
    if (!data) {
      setError(true)
      return
    }
    const path = editing
      ? `/api/courses/${encodeURIComponent(editing.id)}`
      : '/api/courses'
    if (await mutate(path, editing ? 'PATCH' : 'POST', data)) clearForm()
  }

  if (session?.role !== 'admin')
    return <p role="alert">{copy.courseUnavailable}</p>
  return (
    <section className="classroom" aria-labelledby="courses-heading">
      <h2 id="courses-heading">{copy.catalogTitle}</h2>
      <form
        key={formKey}
        className="classroom-form catalog-form"
        onSubmit={(event) => void save(event)}
      >
        <label>
          {copy.courseTitle}
          <input
            name="title"
            defaultValue={editing?.title ?? ''}
            maxLength={120}
            required
          />
        </label>
        <label>
          {copy.courseDescription}
          <textarea
            name="description"
            defaultValue={editing?.description ?? ''}
            maxLength={2000}
            required
          />
        </label>
        <label>
          {copy.courseSegment}
          <select name="segment" defaultValue={editing?.segment ?? 'kattalar'}>
            <option value="bolalar">{copy.segmentBolalar}</option>
            <option value="ielts">{copy.segmentIelts}</option>
            <option value="kattalar">{copy.segmentKattalar}</option>
          </select>
        </label>
        <label>
          {copy.courseLevel}
          <select name="level" defaultValue={editing?.level ?? 'bilmayman'}>
            <option value="boshlovchi">{copy.levelBoshlovchi}</option>
            <option value="orta">{copy.levelOrta}</option>
            <option value="bilmayman">{copy.levelBilmayman}</option>
          </select>
        </label>
        <label className="catalog-publish">
          <input
            name="published"
            type="checkbox"
            defaultChecked={editing?.published ?? false}
          />{' '}
          {copy.coursePublished}
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy
            ? copy.courseSaving
            : editing
              ? copy.courseSave
              : copy.courseCreate}
        </button>
        {editing && (
          <button
            className="btn btn-outline"
            type="button"
            disabled={busy}
            onClick={clearForm}
          >
            {copy.courseCancel}
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="notice" data-tone="error">
          {copy.catalogError}
        </p>
      )}
      {courses.length === 0 ? (
        <p>{copy.catalogEmpty}</p>
      ) : (
        <ul className="rows">
          {courses.map((course) => (
            <li className="row" key={course.id}>
              <strong>{course.title}</strong>
              <p>{course.description}</p>
              <span>
                {course.published ? copy.coursePublished : copy.courseDraft}
              </span>
              <div className="panel-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => {
                    setEditing(course)
                    setFormKey((v) => v + 1)
                    setConfirmId(null)
                  }}
                >
                  {copy.courseEdit}
                </button>
                {confirmId === course.id ? (
                  <>
                    <span>{copy.courseDeletePrompt}</span>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={() => {
                        void mutate(
                          `/api/courses/${encodeURIComponent(course.id)}`,
                          'DELETE',
                        ).then((ok) => {
                          if (ok) {
                            setConfirmId(null)
                            if (editing?.id === course.id) clearForm()
                          }
                        })
                      }}
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
                    onClick={() => setConfirmId(course.id)}
                  >
                    {copy.courseDelete}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
