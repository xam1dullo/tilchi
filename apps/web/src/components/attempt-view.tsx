import { Link } from '@tanstack/react-router'
import type { AppRole } from '../lib/nav'
import { keepAppSearch } from '../lib/preview'
import type { AttemptQuestion, AttemptRecord } from '../lib/attempt'
import type { Copy } from '../lib/i18n'

export function AttemptSummary({
  attempt,
  copy,
}: {
  attempt: Pick<AttemptRecord, 'status' | 'score' | 'maxScore' | 'feedback'>
  copy: Copy
}) {
  if (attempt.status === 'submitted')
    return (
      <p className="notice" data-tone="done" role="status">
        {copy.attemptAwaitingGrade}
      </p>
    )
  if (attempt.status !== 'graded') return null
  return (
    <div className="attempt-summary" data-tone="done">
      <p>
        {copy.attemptScore}:{' '}
        <output className="attempt-score" aria-label={copy.attemptScore}>
          {attempt.score} / {attempt.maxScore}
        </output>
      </p>
      {attempt.feedback ? (
        <div className="attempt-feedback">
          <p className="hint">{copy.attemptFeedback}</p>
          <p>{attempt.feedback}</p>
        </div>
      ) : null}
    </div>
  )
}

export function AttemptQuestionView({
  copy,
  question,
  picked,
  onPick,
}: {
  copy: Copy
  question: AttemptQuestion
  picked: string[]
  onPick: (optionId: string) => void
}) {
  const multi = question.type === 'multi'
  return (
    <fieldset className="question-view question-options">
      <legend className="question-prompt">{question.prompt}</legend>
      {question.result ? (
        <p className="question-tags">
          <span className="tag">
            {copy.attemptScore}:{' '}
            <span className="num">
              {question.result.points} / {question.result.max}
            </span>
          </span>
        </p>
      ) : null}
      {question.options?.map((option) => (
        <label className="catalog-publish" key={option.id}>
          <input
            type={multi ? 'checkbox' : 'radio'}
            name={question.id}
            value={option.id}
            checked={picked.includes(option.id)}
            onChange={() => onPick(option.id)}
          />{' '}
          {option.text}
        </label>
      ))}
    </fieldset>
  )
}

export function AttemptIdentity({
  name,
  groupId,
  copy,
  previewRole,
}: {
  name?: string
  groupId?: string
  copy: Copy
  previewRole: AppRole | null
}) {
  return (
    <div className="attempt-identity">
      <p className="eyebrow">
        {groupId ? (
          <Link
            to="/app/groups/$groupId"
            params={{ groupId }}
            search={keepAppSearch(previewRole)}
          >
            {copy.groups}
          </Link>
        ) : (
          <Link to="/app/tests" search={keepAppSearch(previewRole)}>
            {copy.tests}
          </Link>
        )}
      </p>
      {name ? <p className="attempt-learner">{name}</p> : null}
    </div>
  )
}
