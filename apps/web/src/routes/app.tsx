import { attemptFallback } from '../lib/attempt'
import { RetryButton } from '../components/retry-button'
import { Link, createFileRoute, useRouteContext } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import { LocaleSwitch } from '../components/locale-switch'
import { LoginScreen } from '../components/login-screen'
import { PreviewSwitch } from '../components/preview-switch'
import { messages } from '../lib/i18n'
import { navForRole } from '../lib/nav'
import { isPreviewUser, keepAppSearch, parsePreviewRole } from '../lib/preview'
import { resolveAppSession, type SessionUser } from '../lib/session'

export const Route = createFileRoute('/app')({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: parsePreviewRole(search.preview) ?? undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await resolveAppSession(search.preview)
    const previewRole =
      search.preview ?? (isPreviewUser(session) ? session?.role : undefined)
    return { session, previewRole: previewRole ?? null }
  },
  pendingComponent: SkeletonRows,
  notFoundComponent: AppNotFound,
  errorComponent: LoadError,
  component: AppLayout,
})

function AppLayout() {
  const { session, previewRole } = Route.useRouteContext()
  const { locale } = useRouteContext({ from: '__root__' })
  if (!session) return <LoginScreen locale={locale} />
  const copy = messages(locale)
  const items = navForRole(session.role)
  const search = keepAppSearch(previewRole)
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link className="logo" to="/">
          tilchi
        </Link>
        <LocaleSwitch locale={locale} />
        {isPreviewUser(session) || previewRole ? (
          <PreviewSwitch role={previewRole ?? session.role} copy={copy} />
        ) : null}
        <div className="user-menu">
          <span>{copy[roleKey[session.role]]}</span>
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
      <div className="app-sidebar">
        <Link className="logo app-sidebar-brand" to="/">
          tilchi
        </Link>
        <nav className="app-nav" aria-label={copy.navMain}>
          {(['navLearning', 'navUpdates'] as const).map((group) => (
            <div className="app-nav-group" key={group}>
              <p className="app-nav-label">{copy[group]}</p>
              {items
                .filter((item) =>
                  group === 'navUpdates'
                    ? item.id === 'notifications'
                    : item.id !== 'notifications',
                )
                .map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    search={search}
                    activeOptions={{ exact: true }}
                  >
                    {copy[item.id]}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="app-main">
        <Outlet />
      </div>
      <nav className="app-sheet" aria-label={copy.navMain}>
        {items.map((item) => (
          <Link key={item.id} to={item.to} search={search}>
            {copy[item.id]}
          </Link>
        ))}
      </nav>
    </div>
  )
}

const roleKey = {
  learner: 'roleLearner',
  teacher: 'roleTeacher',
  admin: 'roleAdmin',
} as const

export function SkeletonRows() {
  return (
    <div className="rows" aria-busy="true">
      <div className="row skeleton" />
      <div className="row skeleton" />
      <div className="row skeleton" />
    </div>
  )
}

function LoadError() {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  return (
    <div className="row error-row" role="alert">
      <p>{copy.error}</p>
      <RetryButton label={copy.retry} />
    </div>
  )
}

export type { SessionUser }

export function AppNotFound() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { session, previewRole } = useRouteContext({ from: '/app' })
  const copy = messages(locale)
  const fallback = attemptFallback(session?.role)
  return (
    <div role="alert" className="error-row">
      <h1 ref={(heading) => heading?.focus()} tabIndex={-1}>
        {copy.pageNotFound}
      </h1>
      <Link
        className="btn btn-outline"
        to={fallback.to}
        search={keepAppSearch(previewRole)}
      >
        {copy[fallback.label]}
      </Link>
    </div>
  )
}
