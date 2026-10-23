import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { faqs } from '@/lib/domain/faqs'

export function Faq() {
  return (
    <section className="section faq" id="faq">
      <div className="container">
        <div className="sec-intro">
          <p className="eyebrow">Savol-javob</p>
          <SplitHeading className="h2">Ko'p so'raladigan savollar</SplitHeading>
        </div>
        <Reveal>
          <dl className="faq-rows rows">
            {faqs.map((f) => (
              <div className="faq-row row" key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
