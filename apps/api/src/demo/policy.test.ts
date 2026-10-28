import { describe, expect, it } from 'vitest'
import { demoActor, demoEnabled, parsePreviewRole } from './policy'

describe('demoEnabled', () => {
  it('never seeds or previews outside development and test', () => {
    expect(
      demoEnabled({
        nodeEnv: 'production',
        demo: '1',
        previewRole: 'teacher',
      }),
    ).toBe(false)
    expect(
      demoEnabled({
        nodeEnv: 'staging',
        demo: '1',
        previewRole: 'teacher',
      }),
    ).toBe(false)
    expect(
      demoEnabled({
        nodeEnv: undefined,
        demo: '1',
        previewRole: 'learner',
      }),
    ).toBe(false)
  })

  it('turns on from TILCHI_DEMO or a preview role in development or test', () => {
    expect(
      demoEnabled({
        nodeEnv: 'development',
        demo: '1',
        previewRole: undefined,
      }),
    ).toBe(true)
    expect(
      demoEnabled({
        nodeEnv: 'test',
        demo: undefined,
        previewRole: 'learner',
      }),
    ).toBe(true)
    expect(
      demoEnabled({
        nodeEnv: 'development',
        demo: undefined,
        previewRole: undefined,
      }),
    ).toBe(false)
  })
})

describe('parsePreviewRole', () => {
  it('accepts the three v1 roles and rejects everything else', () => {
    expect(parsePreviewRole('learner')).toBe('learner')
    expect(parsePreviewRole('teacher')).toBe('teacher')
    expect(parsePreviewRole('admin')).toBe('admin')
    expect(parsePreviewRole('parent')).toBeNull()
    expect(parsePreviewRole('')).toBeNull()
  })
})

describe('demoActor', () => {
  it('maps each role to a stable demo user', () => {
    expect(demoActor('teacher').name).toBe('Demo teacher')
    expect(demoActor('learner').userId).not.toBe(demoActor('teacher').userId)
    expect(demoActor('admin').role).toBe('admin')
  })
})
