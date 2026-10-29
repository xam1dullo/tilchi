import { botLink, tgLinkProps } from '@tilchi/content'
import type { CourseRecord } from '../lib/catalog'
import type { Copy } from '../lib/i18n'

/** Only published courses belong on the visitor-facing page. */
export function PublicCatalog({
  courses,
  botUsername,
  copy,
}: {
  courses: CourseRecord[]
  botUsername: string | null
  copy: Copy
}) {
  const published = courses.filter((course) => course.published)
  const segments = {
    bolalar: copy.segmentBolalar,
    ielts: copy.segmentIelts,
    kattalar: copy.segmentKattalar,
  }
  const levels = {
    boshlovchi: copy.levelBoshlovchi,
    orta: copy.levelOrta,
    bilmayman: copy.levelBilmayman,
  }
  return (
    <div className="l-page">
      <header className="l-hero">
        <a className="logo" href="/">
          tilchi
        </a>
        <h1>{copy.catalogTitle}</h1>
      </header>
      <section className="l-section" aria-labelledby="catalog-title">
        <h2 id="catalog-title">{copy.catalogTitle}</h2>
        {published.length === 0 ? (
          <div className="empty-panel">
            <p>{copy.catalogEmpty}</p>
          </div>
        ) : (
          <ul className="l-cards">
            {published.map((course) => (
              <li className="l-card" key={course.id}>
                <h3>{course.title}</h3>
                <p className="tag">
                  {segments[course.segment]} · {levels[course.level]}
                </p>
                <p>{course.description}</p>
                {botUsername ? (
                  <a
                    className="btn btn-outline"
                    {...tgLinkProps(
                      botLink(course.segment, course.level, botUsername),
                    )}
                  >
                    {copy.catalogJoin}
                  </a>
                ) : (
                  <p>{copy.catalogNoTelegram}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
