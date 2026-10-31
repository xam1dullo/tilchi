import { formatLessonTime } from '../lib/classroom'
import type { Copy } from '../lib/i18n'
import type { Locale } from '../lib/locale'
import type { AppRole } from '../lib/nav'
import type { RefObject } from 'react'

export type Notification = {
  id: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

export type Inbox = { notifications: Notification[]; unread: number }

/** Outbox links point only to group, meeting, attempt and my-tests pages inside the app. */
export function notificationLink(
  link: string | null,
  previewRole: AppRole | null,
) {
  if (
    !link ||
    !/^\/app\/((groups|meet|attempts)\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}|assignments)$/i.test(
      link,
    )
  )
    return null
  return previewRole
    ? `${link}?preview=${encodeURIComponent(previewRole)}`
    : link
}

function notificationTime(value: string, locale: Locale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatLessonTime(value, locale)
}

export function NotificationList({
  inbox,
  copy,
  locale,
  previewRole,
  busyId,
  error,
  onRead,
  titleRef,
}: {
  inbox: Inbox
  copy: Copy
  locale: Locale
  previewRole: AppRole | null
  busyId: string | null
  error: boolean
  onRead: (id: string) => void
  titleRef?: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section className="notifications" aria-labelledby="notifications-title">
      <div className="classroom-head">
        <div>
          <p className="eyebrow">{copy.notifications}</p>
          <h2 id="notifications-title" ref={titleRef} tabIndex={-1}>
            {copy.notifications}
          </h2>
        </div>
        <div className="notifications-actions">
          <p className="notifications-count" aria-live="polite">
            {copy.notificationsUnread}: {inbox.unread}
          </p>
          <a
            className="btn btn-outline"
            href={
              previewRole
                ? `/app/notifications?preview=${encodeURIComponent(previewRole)}`
                : '/app/notifications'
            }
          >
            {copy.notificationsRefresh}
          </a>
        </div>
      </div>
      {error ? (
        <p className="notice" role="alert">
          {copy.notificationsReadError}
        </p>
      ) : null}
      {inbox.notifications.length === 0 ? (
        <p className="empty-panel">{copy.notificationsEmpty}</p>
      ) : (
        <ul className="notification-list">
          {inbox.notifications.map((item) => {
            const link = notificationLink(item.link, previewRole)
            const time = notificationTime(item.createdAt, locale)
            return (
              <li
                key={item.id}
                className="notification-row"
                data-unread={item.readAt === null}
              >
                <div className="notification-content">
                  <div className="notification-heading">
                    <strong>{item.title}</strong>
                    {item.readAt === null ? (
                      <span className="notification-unread">
                        {copy.notificationsNew}
                      </span>
                    ) : null}
                  </div>
                  <p>{item.body}</p>
                  {time ? <time dateTime={item.createdAt}>{time}</time> : null}
                  {link ? (
                    <a
                      href={link}
                      aria-label={`${copy.notificationsOpen}: ${item.title}`}
                    >
                      {copy.notificationsOpen}
                    </a>
                  ) : null}
                </div>
                {item.readAt === null ? (
                  <button
                    className="btn btn-outline"
                    type="button"
                    disabled={busyId !== null}
                    aria-label={`${copy.notificationsMarkRead}: ${item.title}`}
                    onClick={() => onRead(item.id)}
                  >
                    {busyId === item.id
                      ? copy.notificationsSaving
                      : copy.notificationsMarkRead}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {inbox.notifications.length === 50 ? (
        <p className="hint">{copy.notificationsLimit}</p>
      ) : null}
    </section>
  )
}
