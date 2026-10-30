import { describe, expect, it } from 'vitest'
import { navForRole } from './nav'

describe('navForRole', () => {
  it('keeps every v1 role inside /app and has no parent entry', () => {
    for (const role of ['learner', 'teacher', 'admin'] as const) {
      const items = navForRole(role)
      expect(items.length).toBeGreaterThan(0)
      expect(items.every((item) => item.to.startsWith('/app'))).toBe(true)
    }
    expect(JSON.stringify(navForRole('learner'))).not.toContain('parent')
  })

  it('shows course management only to admins', () => {
    expect(navForRole('admin').map((item) => item.to)).toContain('/app/courses')
    expect(navForRole('teacher').map((item) => item.to)).not.toContain(
      '/app/courses',
    )
    expect(navForRole('learner').map((item) => item.to)).not.toContain(
      '/app/courses',
    )
  })

  it('shows tests to teachers and admins, not learners', () => {
    const tos = (role: 'learner' | 'teacher' | 'admin') =>
      navForRole(role).map((item) => item.to)
    expect(tos('teacher')).toContain('/app/tests')
    expect(tos('admin')).toContain('/app/tests')
    expect(tos('learner')).not.toContain('/app/tests')
  })
})
