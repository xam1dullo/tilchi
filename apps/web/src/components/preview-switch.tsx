import { useNavigate } from '@tanstack/react-router'
import type { Copy } from '../lib/i18n'
import type { AppRole } from '../lib/nav'
import { keepAppSearch } from '../lib/preview'

const roles = ['learner', 'teacher', 'admin'] as const

export function PreviewSwitch({ role, copy }: { role: AppRole; copy: Copy }) {
  const navigate = useNavigate()
  const labels: Record<AppRole, string> = {
    learner: copy.roleLearner,
    teacher: copy.roleTeacher,
    admin: copy.roleAdmin,
  }
  return (
    <fieldset className="preview-switch">
      <legend>{copy.previewAs}</legend>
      {roles.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={item === role}
          onClick={() => {
            void navigate({ to: '/app', search: keepAppSearch(item) })
          }}
        >
          {labels[item]}
        </button>
      ))}
    </fieldset>
  )
}
