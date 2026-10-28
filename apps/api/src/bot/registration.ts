/** Bump when the privacy notice text changes; everyone is asked again. */
export const CONSENT_VERSION = '2026-10-28'

export const FIELDS = [
  'name',
  'level',
  'studyHistory',
  'phone',
  'goal',
] as const
export type Field = (typeof FIELDS)[number]

export type Registration = {
  userId: string
  name: string | null
  level: string | null
  studyHistory: string | null
  phone: string | null
  goal: string | null
  source: string | null
  consentAt: Date | null
  consentVersion: string | null
}

export const hasConsent = (reg: Registration) =>
  reg.consentAt !== null && reg.consentVersion === CONSENT_VERSION

/** The first prompt not yet answered, so a resumed registration continues. */
export function nextField(reg: Registration): Field | null {
  return FIELDS.find((field) => !reg[field]) ?? null
}

const MAX_ANSWER = 300
const PHONE = /^\+?[0-9][0-9\s\-()]{5,18}[0-9]$/

/** The cleaned answer, or null when it is not acceptable for the field. */
export function parseAnswer(field: Field, text: string): string | null {
  const value = text.replace(/\s+/g, ' ').trim()
  if (!value || value.length > MAX_ANSWER) return null
  if (field === 'phone') {
    return PHONE.test(value) ? value.replace(/[\s\-()]/g, '') : null
  }
  return value
}
