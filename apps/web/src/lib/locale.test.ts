import { describe, expect, it } from 'vitest'
import { localeFromAcceptLanguage, parseLocale } from './locale'

describe('localeFromAcceptLanguage', () => {
  it('picks the first supported tag', () => {
    expect(localeFromAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru')
    expect(localeFromAcceptLanguage('en-US,en;q=0.8')).toBe('en')
    expect(localeFromAcceptLanguage('uz')).toBe('uz')
  })

  it('defaults to uz', () => {
    expect(localeFromAcceptLanguage(null)).toBe('uz')
    expect(localeFromAcceptLanguage('fr-FR')).toBe('uz')
  })
})

describe('parseLocale', () => {
  it('rejects unknown values', () => {
    expect(parseLocale('parent')).toBeNull()
    expect(parseLocale('en')).toBe('en')
  })
})
