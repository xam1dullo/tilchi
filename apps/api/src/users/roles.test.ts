import { describe, expect, it } from 'vitest'
import { RoleAllowlist, parseTelegramIds } from './roles'

describe('parseTelegramIds', () => {
  it('reads a comma separated list of numeric ids', () => {
    expect(parseTelegramIds(' 101, 202 ,303 ')).toEqual({
      ids: new Set(['101', '202', '303']),
      ignored: 0,
    })
  })

  it('counts and drops anything that is not a telegram id', () => {
    expect(parseTelegramIds('101,abc,,-5,1.5,0101,12345678901234567')).toEqual({
      ids: new Set(['101']),
      ignored: 5,
    })
  })

  it('keeps a 16 digit id and ignores a trailing comma silently', () => {
    expect(parseTelegramIds('4503599627370495,')).toEqual({
      ids: new Set(['4503599627370495']),
      ignored: 0,
    })
  })

  it('treats an unset or blank value as an empty list', () => {
    expect(parseTelegramIds(undefined).ids.size).toBe(0)
    expect(parseTelegramIds('  ').ids.size).toBe(0)
  })
})

describe('RoleAllowlist', () => {
  const allowlist = RoleAllowlist.fromEnv({
    TILCHI_ADMIN_TELEGRAM_IDS: '1,2',
    TILCHI_TEACHER_TELEGRAM_IDS: '2,3',
  })

  it('maps allow-listed accounts and defaults everyone else to learner', () => {
    expect(allowlist.roleFor('1')).toBe('admin')
    expect(allowlist.roleFor('3')).toBe('teacher')
    expect(allowlist.roleFor('99')).toBe('learner')
  })

  it('lets admin win when an id is on both lists', () => {
    expect(allowlist.roleFor('2')).toBe('admin')
  })

  it('has no elevated accounts when the env is empty', () => {
    const empty = RoleAllowlist.fromEnv({})
    expect(empty.roleFor('1')).toBe('learner')
  })

  it('reports a malformed entry instead of granting anything for it', () => {
    const warnings: string[] = []
    const typo = RoleAllowlist.fromEnv(
      { TILCHI_ADMIN_TELEGRAM_IDS: '12x', TILCHI_TEACHER_TELEGRAM_IDS: '7' },
      (message) => warnings.push(message),
    )
    expect(typo.roleFor('12')).toBe('learner')
    expect(typo.roleFor('7')).toBe('teacher')
    expect(warnings).toEqual([
      'TILCHI_ADMIN_TELEGRAM_IDS: ignored 1 invalid entries',
    ])
  })
})
