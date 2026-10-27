import { createFileRoute, useRouteContext } from '@tanstack/react-router'
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
      <p>{copy.forbiddenBody}</p>
    </section>
  )
}
