import type { Metadata } from 'next'
import Link from 'next/link'
import { PageTransition } from '@/components/PageTransition'
import { Reveal } from '@/components/gsap/Reveal'
import { Footer } from '@/components/Footer'
import { JsonLd } from '@/components/JsonLd'
import { graphLd, teacherLd } from '@/lib/seo'
import { site, teacher, tgLinkProps } from '@/lib/site'

export const metadata: Metadata = {
  title: "O'qituvchi",
  description: `${teacher.name} — IELTS ${teacher.ielts}, CEFR ${teacher.cefr}, ingliz tili o'qituvchisi va tilshunos-pedagog-tadqiqotchi.`,
  alternates: { canonical: '/teacher/' },
  openGraph: {
    title: `${teacher.name} | Tilchi`,
    description: teacher.summary,
    url: `${site.url}/teacher/`,
    type: 'profile',
  },
}

const arrow = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const external = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3h7v7" />
    <path d="M10 14 21 3" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
)

export default function TeacherPage() {
  return (
    <PageTransition>
      <JsonLd data={graphLd(teacherLd)} />

      <section className="teacher-hero">
        <div className="container teacher-hero-grid">
          <div>
            <p className="eyebrow">O'qituvchi profili</p>
            <h1 className="teacher-title">Mukhtasar <em>Karimjonova</em></h1>
            <p className="teacher-lede">{teacher.summary}</p>
            <div className="teacher-actions">
              <a {...tgLinkProps(site.botUrl)} className="btn btn-primary">
                Dars haqida yozish {arrow}
              </a>
              <a href="#experience" className="btn-text">Tajriba va ta'limni ko'rish</a>
            </div>
          </div>

          <aside className="teacher-identity" aria-label="Mukhtasar Karimjonova qisqacha ma'lumotlari">
            <div className="teacher-avatar" aria-hidden="true">MK</div>
            <p className="eyebrow">Tilchi / 01</p>
            <h2>{teacher.jobTitle}</h2>
            <div className="teacher-score-grid">
              <div><strong>{teacher.ielts}</strong><span>IELTS</span></div>
              <div><strong>{teacher.cefr}</strong><span>CEFR</span></div>
              <div><strong>{teacher.experience}</strong><span>tajriba</span></div>
            </div>
          </aside>
        </div>
      </section>

      <div className="teacher-content">
        <section className="section teacher-section" id="experience">
          <div className="container">
            <div className="sec-intro">
              <p className="eyebrow">Yo'l xaritasi</p>
              <h2 className="h2">Ta'lim va <em>ish tajribasi.</em></h2>
              <p className="lede">Nazariya, sinfdagi amaliyot va IELTS formatidagi tayyorgarlik bir tizimda ishlaydi.</p>
            </div>

            <div className="teacher-columns">
              <Reveal>
                <article className="teacher-card">
                  <div className="teacher-card-heading">
                    <p className="eyebrow">Ta'lim</p>
                    <span className="teacher-card-index num">01</span>
                  </div>
                  <div className="teacher-timeline">
                    {teacher.education.map((item) => (
                      <div className="teacher-timeline-item" key={`${item.degree}-${item.period}`}>
                        <div className="teacher-timeline-period num">{item.period}</div>
                        <div>
                          <h3>{item.degree}</h3>
                          <p>{item.org}</p>
                          <span className="teacher-detail">{item.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </Reveal>

              <Reveal delay={0.08}>
                <article className="teacher-card">
                  <div className="teacher-card-heading">
                    <p className="eyebrow">Mehnat faoliyati</p>
                    <span className="teacher-card-index num">02</span>
                  </div>
                  <div className="teacher-timeline">
                    {teacher.workHistory.map((item) => (
                      <div className="teacher-timeline-item" key={`${item.role}-${item.org}`}>
                        <div className="teacher-timeline-period num">{item.period}</div>
                        <div>
                          <h3>{item.role}</h3>
                          <p>{item.org}</p>
                          {'detail' in item && item.detail && <span className="teacher-detail">{item.detail}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="section teacher-section teacher-section-alt">
          <div className="container">
            <div className="sec-intro">
              <p className="eyebrow">Tayanch</p>
              <h2 className="h2">Sertifikatlar, tillar va <em>metod.</em></h2>
            </div>

            <div className="teacher-detail-grid">
              <Reveal>
                <article className="teacher-card teacher-cert-card">
                  <div className="teacher-card-heading">
                    <p className="eyebrow">Sertifikatlar</p>
                    <span className="teacher-card-index num">03</span>
                  </div>
                  <ul className="teacher-simple-list">
                    {teacher.certifications.map((item) => (
                      <li key={`${item.title}-${item.period}`}>
                        <strong>{item.title}</strong>
                        <span>{item.period} · {item.detail}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>

              <Reveal delay={0.08}>
                <article className="teacher-card">
                  <div className="teacher-card-heading">
                    <p className="eyebrow">Til ko'nikmalari</p>
                    <span className="teacher-card-index num">04</span>
                  </div>
                  <ul className="teacher-language-list">
                    {teacher.languageSkills.map((item) => (
                      <li key={item.language}>
                        <strong>{item.language}</strong>
                        <span>{item.level}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="teacher-interest"><strong>Qiziqishlar:</strong> {teacher.interests}</p>
                </article>
              </Reveal>

              <Reveal delay={0.16}>
                <article className="teacher-card teacher-training-card">
                  <div className="teacher-card-heading">
                    <p className="eyebrow">Qo'shimcha tayyorgarlik</p>
                    <span className="teacher-card-index num">05</span>
                  </div>
                  {teacher.training.map((item) => (
                    <div className="teacher-training" key={item.title}>
                      <h3>{item.title}</h3>
                      <p>{item.org} · {item.period}</p>
                    </div>
                  ))}
                  <p className="teacher-detail">Til o'qituvchisi uchun raqamli vositalarni ham tushunish — darsni sodda, aniq va zamonaviy qilishga yordam beradi.</p>
                </article>
              </Reveal>

              <Reveal delay={0.2}>
                <article className="teacher-card">
                  <div className="teacher-card-heading">
                    <p className="eyebrow">Eʼtirof</p>
                    <span className="teacher-card-index num">06</span>
                  </div>
                  <ul className="teacher-simple-list">
                    {teacher.awards.map((item) => (
                      <li key={`${item.title}-${item.period}`}>
                        <strong>{item.title}</strong>
                        <span>{item.org} · {item.period}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="section teacher-section" id="publications">
          <div className="container">
            <div className="sec-intro">
              <p className="eyebrow">Ilmiy faoliyat</p>
              <h2 className="h2">Dars ortida <em>tadqiqot bor.</em></h2>
              <p className="lede">{teacher.research}. Quyidagi ishlar til, pragmatika va tanqidiy fikrlash kesishmasida yaratilgan.</p>
            </div>

            <div className="teacher-publications">
              {teacher.publications.map((publication, index) => (
                <Reveal key={publication.title} delay={index * 0.04}>
                  <article className="teacher-publication">
                    <span className="teacher-publication-number num">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{publication.title}</h3>
                      <p>{publication.citation}</p>
                    </div>
                    {'href' in publication ? (
                      <a href={publication.href} target="_blank" rel="noopener noreferrer" className="teacher-publication-link" aria-label={`${publication.title} nashrini ochish`}>
                        {external}
                      </a>
                    ) : (
                      <span className="teacher-publication-link teacher-publication-plain" aria-label="Bosma to'plamda chop etilgan">Print</span>
                    )}
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section teacher-cta-section">
          <div className="container">
            <div className="teacher-cta">
              <div>
                <p className="eyebrow">Keyingi qadam</p>
                <h2 className="h2">Sizga mos darsni <em>birga tanlaymiz.</em></h2>
                <p>Bolalar, IELTS yoki kattalar uchun yo'nalishni ayting — birinchi demo dars bepul.</p>
              </div>
              <Link href="/#booking" className="btn btn-primary" transitionTypes={['nav-lateral']}>
                Demo darsni band qilish {arrow}
              </Link>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </PageTransition>
  )
}
