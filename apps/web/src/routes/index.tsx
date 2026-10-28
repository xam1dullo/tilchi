import { botLink, site, tgLinkProps } from '@tilchi/content'
import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { LocaleSwitch } from '../components/locale-switch'
import { messages } from '../lib/i18n'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { locale } = useRouteContext({ from: '__root__' })
  const copy = messages(locale)
  const year = new Date().getFullYear()
  return (
    <>
      <header className="site-bar">
        <a className="logo" href="/">
          tilchi
        </a>
        <div className="site-bar-end">
          <LocaleSwitch locale={locale} />
          <a className="btn btn-outline btn-compact" href="/app">
            {copy.openApp}
          </a>
        </div>
      </header>
      <section className="hero">
        <p className="eyebrow">Tilchi</p>
        <h1>
          Ingliz tilini <em>to&apos;g&apos;ri</em> o&apos;qituvchi bilan
          o&apos;rganing.
        </h1>
        <p className="lede">{site.orgDescription}</p>
        <div className="hero-actions">
          <a className="btn btn-ink" {...tgLinkProps(botLink('', ''))}>
            Telegram&apos;da davom etish
          </a>
        </div>
      </section>
      <footer className="site-foot">
        <span className="num">© {year} tilchi.uz</span>
      </footer>
    </>
  )
}
