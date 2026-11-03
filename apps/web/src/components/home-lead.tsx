import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { MyAssignment } from '../lib/attempt'
import { formatLessonTime } from '../lib/classroom'
import type { GradingItem, HomeNext } from '../lib/home'
import type { Copy } from '../lib/i18n'
import type { keepAppSearch } from '../lib/preview'

type Search = ReturnType<typeof keepAppSearch>

/** The one lesson that matters now. Its time carries the page's only red mark. */
export function HomeLead({
  next,
  copy,
  locale,
  search,
  actions,
}: {
  next: HomeNext | null
  copy: Copy
  locale: string
  search: Search
  /** Start / End / Join for the lesson; without one, Open leads to the group. */
  actions?: ReactNode
}) {
  const live = next?.lesson.status === 'live'
  const can = next?.lesson.can
  const hasActions = Boolean(can && (can.start || can.end || can.join))
  return (
    <section className="home-lead" aria-labelledby="home-lead-title">
      <h2 id="home-lead-title" tabIndex={-1}>
        {live ? copy.homeLiveNow : copy.homeNextLesson}
      </h2>
      {next ? (
        <div className="home-lead-body">
          <div>
            <p className="home-lead-time">
              <time
                id={`primary-lesson-time-${next.lesson.id}`}
                dateTime={next.lesson.scheduledAt}
              >
                <span className="mark">
                  {formatLessonTime(next.lesson.scheduledAt, locale)}
                </span>
              </time>
            </p>
            <p className="home-lead-group">
              <Link
                to="/app/groups/$groupId"
                params={{ groupId: next.group.id }}
                search={search}
              >
                {next.group.name}
              </Link>
            </p>
          </div>
          {hasActions && actions ? (
            actions
          ) : (
            <Link
              className="btn btn-outline"
              to="/app/groups/$groupId"
              params={{ groupId: next.group.id }}
              search={search}
            >
              {copy.cabinetOpen}
            </Link>
          )}
        </div>
      ) : (
        <p className="home-lead-empty">{copy.homeNoLesson}</p>
      )}
    </section>
  )
}

export function HomeGrading({
  queue,
  copy,
  search,
}: {
  queue: GradingItem[]
  copy: Copy
  search: Search
}) {
  if (queue.length === 0) return null
  return (
    <section className="home-list" aria-labelledby="home-grading-title">
      <h2 id="home-grading-title">{copy.homeToGrade}</h2>
      <ul className="rows classroom-list">
        {queue.map((q) => (
          <li key={q.assignmentId} className="row classroom-row">
            <Link
              to="/app/groups/$groupId"
              params={{ groupId: q.groupId }}
              search={search}
            >
              <strong>{q.title}</strong>
              <span>
                {q.groupName} · <span className="num">{q.waiting}</span>{' '}
                {copy.homeWaiting}
              </span>
              <span className="cabinet-action">
                {copy.cabinetOpen} <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HomeDueTests({
  tests,
  more,
  copy,
  locale,
  search,
}: {
  tests: MyAssignment[]
  more: number
  copy: Copy
  locale: string
  search: Search
}) {
  if (tests.length === 0) return null
  return (
    <section className="home-list" aria-labelledby="home-tests-title">
      <h2 id="home-tests-title">{copy.homeDueTests}</h2>
      <ul className="rows classroom-list">
        {tests.map((a) => (
          <li key={a.attemptId} className="row classroom-row">
            <Link
              to="/app/attempts/$attemptId"
              params={{ attemptId: a.attemptId }}
              search={search}
            >
              <strong>{a.title}</strong>
              <span>
                {a.groupName} · {copy.assignmentDeadline}{' '}
                {formatLessonTime(a.deadline, locale)}
              </span>
              <span className="cabinet-action">
                {copy.cabinetOpen} <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <Link
          className="btn-text home-more"
          to="/app/assignments"
          search={search}
        >
          {copy.homeAllTests} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </section>
  )
}
