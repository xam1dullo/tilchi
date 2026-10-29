import { site } from '@tilchi/content'
import { landing } from '@tilchi/content/landing'
import { landingJsonLd } from '@tilchi/content/seo'
import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { LandingPage } from '../components/landing/landing'
import type { Locale } from '../lib/locale'

export const landingHead = (locale: Locale) => {
  const { meta } = landing[locale]
  return {
    meta: [
      { title: meta.title },
      { name: 'description', content: meta.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: site.name },
      { property: 'og:url', content: `${site.url}/` },
      { property: 'og:title', content: meta.title },
      { property: 'og:description', content: meta.description },
      { property: 'og:locale', content: meta.ogLocale },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: `${site.url}/` }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(landingJsonLd(locale)),
      },
    ],
  }
}

export const Route = createFileRoute('/')({
  head: ({ match }) => landingHead(match.context.locale),
  component: Home,
})

function Home() {
  const { locale, botUsername } = useRouteContext({ from: '__root__' })
  return <LandingPage locale={locale} botUsername={botUsername} />
}
