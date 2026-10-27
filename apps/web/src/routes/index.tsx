import { botLink, site, tgLinkProps } from '@tilchi/content'
import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { LocaleSwitch } from '../components/locale-switch'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { locale } = useRouteContext({ from: '__root__' })
  const year = new Date().getFullYear()
  return (
    <>
      <header className="site-bar">
        <a className="logo" href="/">
          tilchi
        </a>
        <LocaleSwitch locale={locale} />
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
