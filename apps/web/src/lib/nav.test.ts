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
})
