import { botLink, tgLinkProps } from '@tilchi/content'
import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { messages } from '../../lib/i18n'

export const Route = createFileRoute('/app/')({
  component: EmptyState,
})

function EmptyState() {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <section className="empty-split">
      <div>
        <p className="eyebrow">{copy.groups}</p>
        <h2>{copy.emptyTitle}</h2>
      </div>
      <div className="empty-panel">
        <p>{copy.emptyBody}</p>
        <div className="panel-actions">
          <a className="btn btn-primary" href="/">
            {copy.catalog}
          </a>
          <a className="btn btn-outline" {...tgLinkProps(botLink('', ''))}>
            {copy.telegramWrite}
          </a>
        </div>
      </div>
    </section>
  )
}
