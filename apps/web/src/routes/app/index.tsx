import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { LoadError, SkeletonRows } from '../../components/async-states'
import { EmptyGroups, GroupRows } from '../../components/groups-view'
import { type GroupRow, loadGroups } from '../../lib/groups'
import { messages } from '../../lib/i18n'

export const Route = createFileRoute('/app/')({
  // Without a session the layout shows the sign-in screen, so there is nothing to ask the API.
  loader: ({ context }): Promise<GroupRow[]> =>
    context.session ? loadGroups() : Promise.resolve([]),
  pendingComponent: SkeletonRows,
  errorComponent: LoadError,
  component: GroupsPage,
})

function GroupsPage() {
  const groups = Route.useLoaderData()
  const { session } = Route.useRouteContext()
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  if (groups.length > 0) return <GroupRows copy={copy} groups={groups} />
  const staff = session?.role === 'teacher' || session?.role === 'admin'
  return <EmptyGroups copy={copy} staff={staff} />
}
