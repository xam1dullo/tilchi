import { useRouter } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { GroupRecord } from '../lib/classroom'
import {
  CONSENT_BY_MAX,
  canSearch,
  consentByValid,
  displayName,
  enrolError,
  needsConsent,
  searchPath,
  type EnrolError,
  type LearnerHit,
} from '../lib/enrol'
import type { Copy } from '../lib/i18n'
import type { AppRole } from '../lib/nav'

/** Admin only (shown from `group.can.manageMembers`): find a learner, add them. */
export function EnrolPanel({
  group,
  previewRole,
  copy,
}: {
  group: Pick<GroupRecord, 'id' | 'kind'>
  previewRole: AppRole | null
  copy: Copy
}) {
  const router = useRouter()
  const ids = useId()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<LearnerHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<EnrolError | 'searchFailed' | null>(null)
  const [consentFor, setConsentFor] = useState<string | null>(null)
  const [consentBy, setConsentBy] = useState('')

  const post = (path: string, body: unknown) =>
    apiFetch(path, { method: 'POST', previewRole, body: JSON.stringify(body) })

  const addMember = (userId: string) =>
    post(`/api/groups/${group.id}/members`, { userId })

  /** A 409 for missing consent opens the consent form instead of an error. */
  const enrol = (userId: string, work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    void work()
      .then(() => {
        setQ('')
        setHits(null)
        setConsentFor(null)
        setConsentBy('')
        return router.invalidate()
      })
      .catch((caught: unknown) => {
        const key = enrolError(caught)
        if (key === 'guardianConsentRequired') setConsentFor(userId)
        else setError(key)
      })
      .finally(() => setBusy(false))
  }

  const add = (hit: LearnerHit) =>
    needsConsent(group.kind, hit)
      ? setConsentFor(hit.id)
      : enrol(hit.id, () => addMember(hit.id))

  return (
    <section className="enrol" aria-labelledby={`${ids}-title`}>
      <h3 id={`${ids}-title`}>{copy.addLearner}</h3>
      <form
        className="classroom-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSearch(q) || busy) return
          setBusy(true)
          setError(null)
          setConsentFor(null)
          void apiFetch<{ users: LearnerHit[] }>(searchPath(q), { previewRole })
            .then((found) => setHits(found.users))
            .catch(() => setError('searchFailed'))
            .finally(() => setBusy(false))
        }}
      >
        <label>
          <span className="sr-only">{copy.learnerSearch}</span>
          <input
            type="search"
            name="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={copy.learnerSearch}
            autoComplete="off"
            maxLength={100}
            aria-describedby={`${ids}-hint`}
          />
        </label>
        <button
          className="btn btn-outline"
          type="submit"
          disabled={busy || !canSearch(q)}
        >
          {copy.searchLearners}
        </button>
        <p id={`${ids}-hint`} className="hint">
          {copy.searchHint}
        </p>
      </form>
      {error ? (
        <p className="notice" data-tone="error" role="alert">
          {copy[error]}
        </p>
      ) : null}
      {hits && hits.length === 0 ? (
        <p className="hint" role="status">
          {copy.noLearnersFound}
        </p>
      ) : null}
      {hits && hits.length > 0 ? (
        <ul className="rows classroom-list">
          {hits.map((hit) => (
            <li key={hit.id} className="row classroom-row lesson-row">
              <div>
                <strong>{displayName(hit)}</strong>
                {hit.level ? <span className="tag">{hit.level}</span> : null}
              </div>
              {consentFor === hit.id ? (
                <form
                  className="classroom-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (busy || !consentByValid(consentBy)) return
                    enrol(hit.id, async () => {
                      await post(`/api/users/${hit.id}/guardian-consent`, {
                        by: consentBy.trim(),
                      })
                      await addMember(hit.id)
                    })
                  }}
                >
                  <p className="notice" data-tone="status" role="status">
                    {copy.consentNeeded}
                  </p>
                  <label>
                    <span className="sr-only">{copy.guardianConsentBy}</span>
                    <input
                      name="by"
                      value={consentBy}
                      onChange={(event) => setConsentBy(event.target.value)}
                      placeholder={copy.guardianConsentBy}
                      autoComplete="off"
                      maxLength={CONSENT_BY_MAX}
                      required
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={busy || !consentByValid(consentBy)}
                  >
                    {copy.recordConsentAndAdd}
                  </button>
                </form>
              ) : (
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={busy}
                  aria-label={`${copy.addToGroup}: ${displayName(hit)}`}
                  onClick={() => add(hit)}
                >
                  {copy.addToGroup}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
