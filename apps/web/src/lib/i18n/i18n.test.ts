import { describe, expect, it } from 'vitest'
import { copy } from './index'

describe('empty state copy', () => {
  it('keeps the locked Uzbek strings', () => {
    expect(copy.uz.groups).toBe('Guruhlar')
    expect(copy.uz.emptyTitle).toBe("Hali guruhingiz yo'q")
    expect(copy.uz.emptyBody).toBe(
      "O'qituvchi sizni guruhga qo'shgach, darslar shu yerda chiqadi.",
    )
    expect(copy.uz.catalog).toBe("Kurslarni ko'rish")
    expect(copy.uz.telegramWrite).toBe("Telegram'da yozish")
    expect(copy.uz.signInTitle).toBe('Telegram orqali kirish')
    expect(copy.uz.signInHint).toBe('Telegram ilovasi ochiladi')
  })

  it('has the same keys in ru and en, with no exclamation marks', () => {
    const keys = Object.keys(copy.uz)
    expect(Object.keys(copy.ru)).toEqual(keys)
    expect(Object.keys(copy.en)).toEqual(keys)
    for (const catalog of Object.values(copy)) {
      for (const value of Object.values(catalog)) {
        expect(value.includes('!')).toBe(false)
      }
    }
  })
})
