import { Link, createFileRoute, useRouteContext } from '@tanstack/react-router'
import { messages } from '../../lib/i18n'

export const Route = createFileRoute('/app/forbidden')({
  component: Forbidden,
})

function Forbidden() {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <section className="forbidden">
      <h1>{copy.forbiddenTitle}</h1>
      <p className="notice" data-tone="warn" role="status">
        {copy.forbiddenBody}
      </p>
      <div className="panel-actions">
        <Link
          className="btn btn-primary"
          to="/app"
          search={{ preview: undefined }}
        >
          {copy.groups}
        </Link>
      </div>
    </section>
  )
}
