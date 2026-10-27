import {
  Link,
  Outlet,
  createFileRoute,
  useRouteContext,
} from '@tanstack/react-router'
import { LocaleSwitch } from '../components/locale-switch'
import { SignIn } from '../components/sign-in'
import { messages } from '../lib/i18n'
import { navForRole } from '../lib/nav'
import { loadSession, type SessionUser } from '../lib/session'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => ({ session: await loadSession() }),
  pendingComponent: SkeletonRows,
  errorComponent: LoadError,
  component: AppLayout,
})

function AppLayout() {
  const { session } = Route.useRouteContext()
  const { locale } = useRouteContext({ from: '__root__' })
  if (!session) return <SignIn locale={locale} />
  const copy = messages(locale)
  const items = navForRole(session.role)
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link className="logo" to="/">
          tilchi
        </Link>
        <LocaleSwitch locale={locale} />
        <div className="user-menu">
          <span>{session.role}</span>
          <button
            type="button"
            onClick={() => {
              void fetch('/auth/logout', {
                method: 'POST',
                credentials: 'include',
              }).then(() => {
                window.location.assign('/app')
              })
            }}
          >
            {copy.logout}
          </button>
        </div>
      </header>
      <nav className="app-nav" aria-label={copy.groups}>
        {items.map((item) => (
          <Link key={item.id} to={item.to} activeOptions={{ exact: true }}>
            {copy.groups}
          </Link>
        ))}
      </nav>
      <div className="app-main">
        <Outlet />
      </div>
      <nav className="app-sheet" aria-label={copy.groups}>
        {items.map((item) => (
          <Link key={item.id} to={item.to}>
            {copy.groups}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function SkeletonRows() {
  return (
    <div className="rows" aria-hidden="true">
      <div className="row skeleton" />
      <div className="row skeleton" />
      <div className="row skeleton" />
    </div>
  )
}

function LoadError({ reset }: { reset: () => void }) {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div className="row error-row" role="alert">
      <p>{copy.error}</p>
      <button className="btn btn-outline" type="button" onClick={reset}>
        {copy.retry}
      </button>
    </div>
  )
}

export type { SessionUser }
