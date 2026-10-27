import {
  Link,
  createFileRoute,
  useNavigate,
  useRouteContext,
} from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import { botLink, tgLinkProps } from '@tilchi/content'
import { LocaleSwitch } from '../components/locale-switch'
import { TelegramGlyph } from '../components/telegram-glyph'
import { messages } from '../lib/i18n'
import type { Locale } from '../lib/locale'
import { navForRole } from '../lib/nav'
import { loadSession, type SessionUser } from '../lib/session'

const handoffs = ['waiting', 'expired', 'confirmed'] as const
type Handoff = (typeof handoffs)[number]

export const Route = createFileRoute('/app')({
  validateSearch: (search: Record<string, unknown>) => {
    const value = search.handoff
    const handoff = handoffs.find((item) => item === value)
    return { handoff }
  },
  beforeLoad: async () => ({ session: await loadSession() }),
  pendingComponent: SkeletonRows,
  errorComponent: LoadError,
  component: AppLayout,
})

function AppLayout() {
  const { session } = Route.useRouteContext()
  const { locale } = useRouteContext({ from: '__root__' })
  const { handoff } = Route.useSearch()
  if (!session) return <SignIn locale={locale} handoff={handoff} />
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
          <Link
            key={item.id}
            to={item.to}
            search={{ handoff: undefined }}
            activeOptions={{ exact: true }}
          >
            {copy.groups}
          </Link>
        ))}
      </nav>
      <div className="app-main">
        <Outlet />
      </div>
      <nav className="app-sheet" aria-label={copy.groups}>
        {items.map((item) => (
          <Link key={item.id} to={item.to} search={{ handoff: undefined }}>
            {copy.groups}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function SignIn({
  locale,
  handoff,
}: {
  locale: Locale
  handoff: Handoff | undefined
}) {
  const copy = messages(locale)
  const navigate = useNavigate()
  const note =
    handoff === 'waiting'
      ? copy.waiting
      : handoff === 'expired'
        ? copy.expired
        : handoff === 'confirmed'
          ? copy.confirmed
          : null
  return (
    <section className="sign-in">
      <h1>{copy.signInTitle}</h1>
      <a className="btn btn-ink" {...tgLinkProps(botLink('', ''))}>
        <TelegramGlyph />
        {copy.signInButton}
      </a>
      <p className="hint">{copy.signInHint}</p>
      {note ? <p className="handoff">{note}</p> : null}
      {handoff === 'expired' ? (
        <p>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              void navigate({ to: '/app', search: { handoff: undefined } })
            }}
          >
            {copy.retry}
          </button>
        </p>
      ) : null}
    </section>
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
