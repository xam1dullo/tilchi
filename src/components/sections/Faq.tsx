import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { faqs } from '@/lib/domain/faqs'

export function Faq() {
  return (
    <section className="section faq" id="faq">
      <div className="container">
        <div className="faq-inner">
          <div style={{ textAlign: 'center', marginBottom: 'clamp(32px, 3.6vw, 44px)' }}>
            <p className="eyebrow" style={{ justifyContent: 'center' }}>
              Savol-javob
            </p>
            <SplitHeading className="h2" >
              Ko'p so'raladigan savollar
            </SplitHeading>
          </div>
          <Reveal>
            <div className="faq-list">
              {faqs.map((f) => (
                <details className="faq-item" key={f.q}>
                  <summary>{f.q}</summary>
                  <div className="faq-body">{f.a}</div>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
