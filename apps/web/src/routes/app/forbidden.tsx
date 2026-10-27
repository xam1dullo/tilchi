import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { ForbiddenView } from '../../components/async-states'
import { messages } from '../../lib/i18n'

export const Route = createFileRoute('/app/forbidden')({
  component: Forbidden,
})

function Forbidden() {
  const { locale } = useRouteContext({ from: '__root__' })
  return <ForbiddenView copy={messages(locale)} />
}
