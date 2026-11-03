import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { apiFetch } from '../lib/api'
import {
  type LessonRecord,
  type MaterialsForm,
  lessonMaterialsBody,
  lessonMaterialsError,
} from '../lib/classroom'
import type { Copy } from '../lib/i18n'

type MaterialsCopy = Pick<
  Copy,
  | 'materials'
  | 'materialSlide'
  | 'materialCanvas'
  | 'lessonTopic'
  | 'slideUrl'
  | 'canvasUrl'
  | 'saveMaterials'
  | 'materialsSaved'
  | 'materialsInvalid'
  | 'lessonActionFailed'
>

/** Slide / whiteboard links for everyone in the lesson; nothing when unset. */
export function MaterialLinks({
  lesson,
  copy,
}: {
  lesson: Pick<LessonRecord, 'slideUrl' | 'canvasUrl'>
  copy: Pick<MaterialsCopy, 'materials' | 'materialSlide' | 'materialCanvas'>
}) {
  const links = [
    [lesson.slideUrl, copy.materialSlide],
    [lesson.canvasUrl, copy.materialCanvas],
  ].filter((pair): pair is [string, string] => Boolean(pair[0]))
  if (links.length === 0) return null
  return (
    <p className="hint lesson-material-links">
      {copy.materials}:{' '}
      {links.map(([href, label], index) => (
        <span key={href}>
          {index > 0 ? ' · ' : null}
          <a href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        </span>
      ))}
    </p>
  )
}

/** The three material inputs, shared by the schedule form and the editor. */
export function MaterialFields({
  form,
  onChange,
  copy,
}: {
  form: MaterialsForm
  onChange: (next: MaterialsForm) => void
  copy: Pick<MaterialsCopy, 'lessonTopic' | 'slideUrl' | 'canvasUrl'>
}) {
  const field = (key: keyof MaterialsForm, label: string, type: string) => (
    <label>
      <span>{label}</span>
      <input
        type={type}
        name={key}
        maxLength={type === 'url' ? 2048 : 120}
        value={form[key]}
        onChange={(event) => onChange({ ...form, [key]: event.target.value })}
      />
    </label>
  )
  return (
    <>
      {field('topic', copy.lessonTopic, 'text')}
      {field('slideUrl', copy.slideUrl, 'url')}
      {field('canvasUrl', copy.canvasUrl, 'url')}
    </>
  )
}

/** Disclosure in the lessons rail where the teacher edits the materials. */
export function MaterialsEditor({
  lesson,
  previewRole,
  copy,
}: {
  lesson: LessonRecord
  previewRole: 'learner' | 'teacher' | 'admin' | null
  copy: MaterialsCopy
}) {
  const router = useRouter()
  const [form, setForm] = useState<MaterialsForm>({
    topic: lesson.topic ?? '',
    slideUrl: lesson.slideUrl ?? '',
    canvasUrl: lesson.canvasUrl ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<keyof MaterialsCopy | null>(null)
  return (
    <details className="lesson-materials">
      <summary>{copy.materials}</summary>
      <form
        className="classroom-form"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setNote(null)
          apiFetch(`/api/lessons/${lesson.id}/materials`, {
            method: 'POST',
            previewRole,
            body: JSON.stringify(lessonMaterialsBody(form)),
          })
            .then(() =>
              router.invalidate().then(() => setNote('materialsSaved')),
            )
            .catch((error: unknown) => setNote(lessonMaterialsError(error)))
            .finally(() => setBusy(false))
        }}
      >
        <MaterialFields form={form} onChange={setForm} copy={copy} />
        <button className="btn btn-outline" type="submit" disabled={busy}>
          {copy.saveMaterials}
        </button>
        {note ? (
          <p className="notice hint" role="status">
            {copy[note]}
          </p>
        ) : null}
      </form>
    </details>
  )
}
