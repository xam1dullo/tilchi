import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../lib/api'
import {
  createGroupBody,
  createGroupError,
  createGroupView,
  type CreateGroupForm,
} from '../lib/classroom'
import { messages } from '../lib/i18n'
import { locales, type Locale } from '../lib/locale'
import { CreateGroupFormView } from './create-group-form'

const teachers = [
  { id: 't1', name: 'Mukhtasar' },
  { id: 't2', name: null },
]
const base: CreateGroupForm = {
  name: 'A1',
  teacherId: 't1',
  assignTeacher: true,
  teachers,
  busy: false,
}

function render(
  form: CreateGroupForm,
  error: 'teacherRequired' | 'createGroupFailed' | null = null,
  locale: Locale = 'en',
) {
  return renderToStaticMarkup(
    createElement(CreateGroupFormView, {
      copy: messages(locale),
      form,
      error,
      onName: () => {},
      onTeacher: () => {},
      onSubmit: () => {},
    }),
  )
}

describe('createGroupView', () => {
  it('needs a chosen teacher for an admin, not for a teacher', () => {
    expect(createGroupView(base).canSubmit).toBe(true)
    expect(createGroupView({ ...base, teacherId: '' }).canSubmit).toBe(false)
    expect(createGroupView({ ...base, teacherId: 'gone' }).canSubmit).toBe(
      false,
    )
    const own = { ...base, assignTeacher: false, teacherId: '', teachers: [] }
    expect(createGroupView(own)).toEqual({
      showTeacher: false,
      noTeachers: false,
      canSubmit: true,
    })
  })

  it('blocks submit when busy, nameless, or no teachers exist', () => {
    expect(createGroupView({ ...base, busy: true }).canSubmit).toBe(false)
    expect(createGroupView({ ...base, name: '  ' }).canSubmit).toBe(false)
    expect(createGroupView({ ...base, teachers: [] })).toEqual({
      showTeacher: false,
      noTeachers: true,
      canSubmit: false,
    })
  })
})

describe('createGroupBody / createGroupError', () => {
  it('sends teacherId only for an admin', () => {
    expect(createGroupBody(base)).toEqual({ name: 'A1', teacherId: 't1' })
    expect(createGroupBody({ ...base, assignTeacher: false })).toEqual({
      name: 'A1',
    })
  })

  it('maps teacher_required, and any other failure to the generic copy', () => {
    expect(
      createGroupError(new ApiError(400, { error: 'teacher_required' })),
    ).toBe('teacherRequired')
    expect(createGroupError(new ApiError(400, { error: 'x' }))).toBe(
      'createGroupFailed',
    )
    expect(createGroupError(new TypeError('network'))).toBe('createGroupFailed')
  })
})

describe('CreateGroupFormView', () => {
  it('shows the teacher select with every teacher for an admin', () => {
    const html = render(base)
    expect(html).toContain('<select')
    expect(html).toContain('Mukhtasar')
    expect(html).toContain('Choose a teacher')
    expect(html).not.toContain('role="alert"')
  })

  it('keeps teachers on the name-only form', () => {
    expect(render({ ...base, assignTeacher: false })).not.toContain('<select')
  })

  it('says so when there are no teachers, and disables submit', () => {
    const html = render({ ...base, teachers: [] })
    expect(html).toContain('No teachers yet')
    expect(html).not.toContain('<select')
    expect(html).toContain('disabled')
  })

  it('renders the 400 teacher_required inline with a retry button', () => {
    const html = render(base, 'teacherRequired')
    expect(html).toContain('role="alert">Choose an active teacher')
    expect(html).toContain('Try again')
  })

  it('has the admin strings in every locale', () => {
    for (const locale of locales) {
      const copy = messages(locale)
      expect(render(base, 'createGroupFailed', locale)).toContain(copy.retry)
      expect(copy.teachersEmpty).not.toBe('')
    }
  })
})
