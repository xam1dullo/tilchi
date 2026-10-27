import { describe, expect, it } from 'vitest'
import { copy } from './i18n'
import { appRoles, navForRole, roleLabel } from './nav'

describe('navForRole', () => {
  it('keeps every v1 role inside /app and has no parent entry', () => {
    for (const role of ['learner', 'teacher', 'admin'] as const) {
      const items = navForRole(role)
      expect(items.length).toBeGreaterThan(0)
      expect(items.every((item) => item.to.startsWith('/app'))).toBe(true)
    }
    expect(JSON.stringify(navForRole('learner'))).not.toContain('parent')
  })
})

describe('roleLabel', () => {
  it('names every role in every language, and no two roles share a name', () => {
    for (const messages of Object.values(copy)) {
      const labels = appRoles.map((role) => roleLabel(messages, role))
      for (const label of labels) expect(label.length).toBeGreaterThan(0)
      expect(new Set(labels).size).toBe(appRoles.length)
    }
  })

  it('never shows the internal role id', () => {
    for (const messages of Object.values(copy)) {
      for (const role of appRoles) {
        expect(roleLabel(messages, role)).not.toBe(role)
      }
    }
  })
})
