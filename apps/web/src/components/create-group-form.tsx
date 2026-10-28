import {
  createGroupView,
  type CreateGroupForm,
  type Teacher,
} from '../lib/classroom'
import type { Copy } from '../lib/i18n'

export type CreateGroupFormProps = {
  copy: Copy
  form: CreateGroupForm
  /** Key of the failure message in `copy`, or null. */
  error: 'teacherRequired' | 'createGroupFailed' | null
  onName: (value: string) => void
  onTeacher: (value: string) => void
  onSubmit: () => void
}

const teacherName = (teacher: Teacher) => teacher.name ?? teacher.id.slice(0, 8)

/** Painting only: state and the request live in the route. */
export function CreateGroupFormView({
  copy,
  form,
  error,
  onName,
  onTeacher,
  onSubmit,
}: CreateGroupFormProps) {
  const view = createGroupView(form)
  return (
    <form
      className="classroom-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (view.canSubmit) onSubmit()
      }}
    >
      <label>
        <span className="sr-only">{copy.groupName}</span>
        <input
          name="name"
          value={form.name}
          onChange={(event) => onName(event.target.value)}
          placeholder={copy.groupName}
          autoComplete="off"
          required
        />
      </label>
      {view.showTeacher ? (
        <label>
          <span className="sr-only">{copy.teacherLabel}</span>
          <select
            name="teacherId"
            value={form.teacherId}
            onChange={(event) => onTeacher(event.target.value)}
            required
          >
            <option value="">{copy.teacherPlaceholder}</option>
            {form.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacherName(teacher)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        className="btn btn-primary"
        type="submit"
        disabled={!view.canSubmit}
      >
        {error ? copy.retry : copy.createGroup}
      </button>
      {view.noTeachers ? (
        <p className="notice" data-tone="status" role="status">
          {copy.teachersEmpty}
        </p>
      ) : null}
      {error ? (
        <p className="notice" data-tone="error" role="alert">
          {copy[error]}
        </p>
      ) : null}
    </form>
  )
}
