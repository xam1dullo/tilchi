import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { teacher } from '@/lib/site'

export function Research() {
  return (
    <section className="section" id="tadqiqot">
      <div className="container">
        <div className="sec-intro">
          <p className="eyebrow">Ilmiy faoliyat</p>
          <SplitHeading className="h2">
            O'qitish — <em>tadqiqot bilan.</em>
          </SplitHeading>
          <p className="lede">{teacher.research}. O'qitish metodikasi ilmiy ishlar va sertifikatlangan tayyorgarlik asosida qurilgan.</p>
        </div>

        <div className="research-grid">
          <Reveal>
            <article className="research-card research-pub">
              <p className="eyebrow" style={{ fontSize: '0.7rem' }}>
                Publikatsiya
              </p>
              <h3 className="pub-title">{teacher.researchWork.title}</h3>
              <p className="research-meta">{teacher.researchWork.venue}</p>
              <blockquote>
                “O'qish va yozish ko'nikmalari — bu nafaqat mashq, balki tanqidiy fikrlash strategiyalarining natijasidir.”
              </blockquote>
            </article>
          </Reveal>

          <Reveal delay={0.08}>
            <article className="research-card">
              <p className="eyebrow" style={{ fontSize: '0.7rem' }}>
                Ilmiy daraja
              </p>
              <h3>Magistratura — Lingvistika</h3>
              <p>{teacher.education[0].org}, {teacher.education[0].period}</p>
              <p className="research-meta">Bakalavr: imtiyozli diplom, 98% (4.92/5.0)</p>
            </article>
          </Reveal>

          <Reveal delay={0.16}>
            <article className="research-card">
              <p className="eyebrow" style={{ fontSize: '0.7rem' }}>
                Sertifikatlar
              </p>
              <h3>{teacher.cert} · IELTS {teacher.ielts} · CEFR {teacher.cefr}</h3>
              <p className="research-meta">O'qitish metodikasi, til darajasi va test tayyorgarligi bo'yicha xalqaro sertifikatlar.</p>
            </article>
          </Reveal>

          <Reveal delay={0.24}>
            <article className="research-card">
              <p className="eyebrow" style={{ fontSize: '0.7rem' }}>
                Tan olinishi
              </p>
              <h3>{teacher.awards[0].title}</h3>
              <p className="research-meta">{teacher.awards[0].org}, {teacher.awards[0].period}</p>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
