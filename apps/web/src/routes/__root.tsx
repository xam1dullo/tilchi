import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import frauncesUrl from '@fontsource-variable/fraunces/files/fraunces-latin-soft-normal.woff2?url'
import geistUrl from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
import appCss from '../styles/app.css?url'
import { messages } from '../lib/i18n'
import {
  localeFromAcceptLanguage,
  parseLocale,
  type Locale,
} from '../lib/locale'

const readLocale = createIsomorphicFn()
  .server(async (): Promise<Locale> => {
    const { getCookie, getRequestHeader } = await import(
      '@tanstack/react-start/server'
    )
    const cookie = parseLocale(getCookie('tilchi_locale'))
    if (cookie) return cookie
    return localeFromAcceptLanguage(getRequestHeader('accept-language') ?? null)
  })
  .client((): Locale => {
    const match = document.cookie.match(/(?:^|; )tilchi_locale=([^;]+)/)
    const cookie = parseLocale(decodeURIComponent(match?.[1] ?? ''))
    if (cookie) return cookie
    return localeFromAcceptLanguage(navigator.languages.join(','))
  })

export const Route = createRootRoute({
  beforeLoad: async () => ({ locale: await readLocale() }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#FCFCFA' },
      { title: 'Tilchi' },
    ],
    links: [
      {
        rel: 'preload',
        href: frauncesUrl,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: geistUrl,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootDocument,
})

function RootDocument() {
  const { locale } = Route.useRouteContext()
  const copy = messages(locale)
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip" href="#main">
          {copy.skip}
        </a>
        <div className="grain" aria-hidden="true" />
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <Scripts />
      </body>
    </html>
  )
}
