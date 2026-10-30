import type { GroupRecord } from './classroom'

/** One row of `GET /api/users?q=`: no contact details. */
export type LearnerHit = {
  id: string
  name: string | null
  level: string | null
  guardianConsent: boolean
}

export type Member = {
  id: string
  name: string | null
  role: 'learner' | 'teacher' | 'admin'
}

export const CONSENT_BY_MAX = 120

/** The server finds nothing under 2 characters, so don't ask it. */
export const canSearch = (q: string) => q.trim().length >= 2

export const searchPath = (q: string) =>
  `/api/users?q=${encodeURIComponent(q.trim())}`

/** A kids group takes a learner only once a guardian's consent is on record. */
export const needsConsent = (kind: GroupRecord['kind'], hit: LearnerHit) =>
  kind === 'kids' && !hit.guardianConsent

export const consentByValid = (by: string) => {
  const text = by.trim()
  return text.length > 0 && text.length <= CONSENT_BY_MAX
}

export type EnrolError =
  | 'groupFull'
  | 'userNotFound'
  | 'guardianConsentRequired'
  | 'enrolFailed'

const ENROL_ERRORS: Record<string, EnrolError> = {
  group_full: 'groupFull',
  user_not_found: 'userNotFound',
  guardian_consent_required: 'guardianConsentRequired',
}

/** Copy key for a failed add or consent; anything unknown is generic. */
export function enrolError(error: unknown): EnrolError {
  return error instanceof Error && Object.hasOwn(ENROL_ERRORS, error.message)
    ? ENROL_ERRORS[error.message]
    : 'enrolFailed'
}

export const displayName = (person: { id: string; name: string | null }) =>
  person.name ?? person.id.slice(0, 8)

export type ConsentForm = { for: string | null; by: string }

/** Opening the form for another learner never carries the last guardian over. */
export const openConsent = (form: ConsentForm, userId: string): ConsentForm =>
  form.for === userId ? form : { for: userId, by: '' }

/** Consent is on record: the hit no longer asks for it, so a retry only adds. */
export const markConsented = (hits: LearnerHit[] | null, userId: string) =>
  hits?.map((h) => (h.id === userId ? { ...h, guardianConsent: true } : h)) ??
  null
