import { SplitHeading } from '@/components/gsap/SplitHeading'
import { ScrubList } from '@/components/gsap/ScrubList'
import Link from 'next/link'
import { teacher } from '@/lib/site'

export function Research() {
  return (
    <section className="section" id="research">
      <div className="container">
        <div className="sec-intro">
          <p className="eyebrow">Ilmiy faoliyat</p>
          <SplitHeading className="h2">
            O'qitish — <em>tadqiqot bilan.</em>
          </SplitHeading>
          <p className="lede">{teacher.research}. O'qitish metodikasi ilmiy ishlar va sertifikatlangan tayyorgarlik asosida qurilgan.</p>
        </div>

        <ScrubList className="research-grid">
          <article className="research-card research-pub">
            <p className="eyebrow pub-eyebrow">
              Publikatsiya
            </p>
            <h3 className="pub-title">{teacher.researchWork.title}</h3>
            <p className="research-meta">{teacher.researchWork.venue}</p>
            <blockquote>
              “O'qish va yozish ko'nikmalari — bu nafaqat mashq, balki tanqidiy fikrlash strategiyalarining natijasidir.”
            </blockquote>
          </article>

          <article className="research-card">
            <p className="eyebrow pub-eyebrow">
              Ilmiy daraja
            </p>
            <h3>Magistratura — Lingvistika</h3>
            <p>{teacher.education[0].org}, {teacher.education[0].period}</p>
            <p className="research-meta">Bakalavr: imtiyozli diplom, 98% (4.92/5.0)</p>
          </article>

          <article className="research-card">
            <p className="eyebrow pub-eyebrow">
              Sertifikatlar
            </p>
            <h3>IELTS {teacher.ielts} · CEFR {teacher.cefr}</h3>
            <p className="research-meta">IELTS test natijasi va CEFR daraja — tilni tasdiqlangan ko'rsatkichlar.</p>
          </article>

          <article className="research-card">
            <p className="eyebrow pub-eyebrow">
              Tan olinishi
            </p>
            <h3>{teacher.awards[0].title}</h3>
            <p className="research-meta">{teacher.awards[0].org}, {teacher.awards[0].period}</p>
          </article>
        </ScrubList>
        <Link href="/teacher#publications" className="research-more" transitionTypes={['nav-forward']}>
          Barcha nashrlar va professional profilni ko'rish
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  )
}
