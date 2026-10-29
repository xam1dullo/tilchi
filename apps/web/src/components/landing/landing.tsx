import { teacher } from '@tilchi/content'
import {
  ctaHref,
  landing,
  levelIds,
  type Landing as Copy,
  type SegmentId,
} from '@tilchi/content/landing'
import { tgLinkProps } from '@tilchi/content'
import type { Locale } from '../../lib/locale'
import { messages } from '../../lib/i18n'
import { LocaleSwitch } from '../locale-switch'
import { TelegramGlyph } from '../telegram-glyph'

function Head({
  eyebrow,
  title,
  id,
}: {
  eyebrow: string
  title: string
  id: string
}) {
  return (
    <header className="l-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
    </header>
  )
}

function Hero({
  copy,
  botUsername,
}: {
  copy: Copy
  botUsername: string | null
}) {
  const { hero } = copy
  return (
    <section className="l-hero" aria-labelledby="l-hero-title">
      <p className="eyebrow">{hero.eyebrow}</p>
      <h1 id="l-hero-title">
        {hero.before}
        <em>{hero.em}</em>
        {hero.after}
      </h1>
      <p className="lede">{hero.lede}</p>
      <div className="hero-actions">
        {botUsername && (
          <a
            className="btn btn-ink"
            {...tgLinkProps(ctaHref(undefined, undefined, botUsername))}
          >
            <TelegramGlyph />
            {hero.cta}
          </a>
        )}
      </div>
      <ul className="l-facts">
        {hero.facts.map((fact) => (
          <li key={fact} className="num">
            {fact}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Trust({ copy }: { copy: Copy }) {
  return (
    <dl className="l-trust">
      {copy.trust.map((item) => (
        <div key={item.dt}>
          <dt className="stat">{item.dt}</dt>
          <dd>{item.dd}</dd>
        </div>
      ))}
    </dl>
  )
}

function Segments({
  copy,
  botUsername,
}: {
  copy: Copy
  botUsername: string | null
}) {
  const { segments } = copy
  return (
    <section className="l-section" aria-labelledby="l-seg">
      <Head id="l-seg" eyebrow={segments.eyebrow} title={segments.title} />
      <ul className="l-cards">
        {segments.cards.map((card) => (
          <li key={card.segment} className="l-card">
            <p className="tag">{card.age}</p>
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
            <ul className="l-checks">
              {card.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {botUsername && (
              <a
                className="btn btn-outline"
                {...tgLinkProps(
                  ctaHref(card.segment, 'bilmayman', botUsername),
                )}
              >
                {segments.cta}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Teacher({ copy }: { copy: Copy }) {
  const t = copy.teacher
  return (
    <section className="l-section" id="teacher" aria-labelledby="l-teacher">
      <div className="l-teacher">
        <div className="l-mono" aria-hidden="true">
          {teacher.initials}
        </div>
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="l-teacher">{t.title}</h2>
          <p className="l-role">{t.role}</p>
          <p>{t.summary}</p>
          <p>{t.research}</p>
          <dl className="l-stats">
            {t.facts.map((fact) => (
              <div key={fact.k}>
                <dt>{fact.k}</dt>
                <dd className="stat">{fact.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

function Method({ copy }: { copy: Copy }) {
  const { method } = copy
  return (
    <section className="l-section" aria-labelledby="l-method">
      <Head id="l-method" eyebrow={method.eyebrow} title={method.title} />
      <ol className="l-steps">
        {method.steps.map((step) => (
          <li key={step.n}>
            <span className="stat l-n">{step.n}</span>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
            <p className="tag">{step.time}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Courses({
  copy,
  botUsername,
}: {
  copy: Copy
  botUsername: string | null
}) {
  const { courses, segmentLabels, levelLabels } = copy
  return (
    <section className="l-section" id="programs" aria-labelledby="l-courses">
      <Head id="l-courses" eyebrow={courses.eyebrow} title={courses.title} />
      <ul className="l-courses">
        {courses.items.map((course) => (
          <li key={course.id} className="l-course">
            <h3>{course.name}</h3>
            <p>{course.desc}</p>
            <ul className="l-tags">
              {course.facts.map((fact) => (
                <li key={fact} className="tag">
                  {fact}
                </li>
              ))}
            </ul>
            {course.segments.map((seg: SegmentId) => (
              <div key={seg} className="l-levels">
                <span className="l-levels-label">
                  {segmentLabels[seg]} · {courses.levelsLabel}
                </span>
                {levelIds.map(
                  (lv) =>
                    botUsername && (
                      <a
                        key={lv}
                        className="btn btn-outline btn-compact"
                        {...tgLinkProps(ctaHref(seg, lv, botUsername))}
                      >
                        {levelLabels[lv]}
                      </a>
                    ),
                )}
              </div>
            ))}
          </li>
        ))}
      </ul>
      <p className="hint">{courses.price}</p>
    </section>
  )
}

function Faq({ copy }: { copy: Copy }) {
  return (
    <section className="l-section" id="faq" aria-labelledby="l-faq">
      <Head id="l-faq" eyebrow={copy.faq.eyebrow} title={copy.faq.title} />
      <div className="l-faq">
        {copy.faq.items.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function LandingPage({
  locale,
  botUsername = 'tilchiuz_bot',
}: {
  locale: Locale
  botUsername?: string | null
}) {
  const copy = landing[locale]
  const chrome = messages(locale)
  const year = new Date().getFullYear()
  return (
    <>
      <header className="site-bar">
        <a className="logo" href="/">
          tilchi
        </a>
        <nav className="l-nav" aria-label={chrome.navMain}>
          <a href="#programs">{copy.nav.programs}</a>
          <a href="/courses">{chrome.catalog}</a>
          <a href="#teacher">{copy.nav.teacher}</a>
          <a href="#faq">{copy.nav.faq}</a>
        </nav>
        <div className="site-bar-end">
          <LocaleSwitch locale={locale} />
          <a className="btn btn-outline btn-compact" href="/app">
            {chrome.openApp}
          </a>
        </div>
      </header>
      <div className="l-page">
        <Hero copy={copy} botUsername={botUsername} />
        <Trust copy={copy} />
        <Segments copy={copy} botUsername={botUsername} />
        <Teacher copy={copy} />
        <Method copy={copy} />
        <Courses copy={copy} botUsername={botUsername} />
        <Faq copy={copy} />
        <section className="l-final" aria-labelledby="l-final">
          <h2 id="l-final">{copy.cta.title}</h2>
          <p>{copy.cta.body}</p>
          {botUsername && (
            <a
              className="btn btn-primary"
              {...tgLinkProps(ctaHref(undefined, undefined, botUsername))}
            >
              <TelegramGlyph />
              {copy.cta.button}
            </a>
          )}
        </section>
      </div>
      <footer className="site-foot">
        <span className="num">© {year} tilchi.uz</span>
        <span>{copy.foot.tagline}</span>
        <a href="/app">{chrome.openApp}</a>
      </footer>
    </>
  )
}
