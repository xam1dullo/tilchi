import { Reveal } from '@/components/gsap/Reveal'
import { trustItems } from '@/lib/domain/trust'

export function TrustBand() {
  return (
    <section className="trust" aria-label="Nega ishonish mumkin">
      <div className="container">
        <Reveal>
          <dl className="trust-inner">
            {trustItems.map((i) => (
              <div className="trust-item" key={i.dt}>
                <dt className={i.num ? 'num' : ''}>{i.dt}</dt>
                <dd>{i.dd}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
