import { en } from './en'
import { ru } from './ru'
import { uz } from './uz'
import type { Locale } from '../locale'

export const copy = { uz, ru, en }
export type Copy = typeof uz

export function messages(locale: Locale): Copy {
  return copy[locale]
}
