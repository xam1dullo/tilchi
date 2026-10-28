import { describe, expect, it } from 'vitest'
import {
  isPreviewUser,
  keepAppSearch,
  parsePreviewRole,
  previewUser,
} from './preview'

describe('parsePreviewRole', () => {
  it('accepts learner and teacher and rejects parent', () => {
    expect(parsePreviewRole('learner')).toBe('learner')
    expect(parsePreviewRole('teacher')).toBe('teacher')
    expect(parsePreviewRole('parent')).toBeNull()
  })
})

describe('previewUser', () => {
  it('keeps preview ids off the session cookie name', () => {
    expect(previewUser('teacher')).toEqual({
      userId: 'preview-teacher',
      role: 'teacher',
      name: 'Demo teacher',
    })
    expect(isPreviewUser(previewUser('learner'))).toBe(true)
    expect(isPreviewUser({ userId: 'real', role: 'learner' })).toBe(false)
    expect(JSON.stringify(previewUser('admin'))).not.toContain('tilchi_sid')
  })
})

describe('keepAppSearch', () => {
  it('carries the preview role across app routes', () => {
    expect(keepAppSearch('teacher')).toEqual({
      handoff: undefined,
      preview: 'teacher',
    })
  })
})
