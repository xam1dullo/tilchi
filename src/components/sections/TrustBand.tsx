import { Reveal } from '@/components/gsap/Reveal'
import { NumCounter } from '@/components/gsap/NumCounter'
import { trustItems } from '@/lib/domain/trust'

export function TrustBand() {
  return (
    <section className="trust" aria-label="Nega ishonish mumkin">
      <div className="container">
        <Reveal>
          <dl className="trust-row">
            {trustItems.map((i) => (
              <div className="trust-item" key={i.dt}>
                {i.num ? <NumCounter value={Number(i.dt)} className="stat num" /> : <dt className="stat num">{i.dt}</dt>}
                <dd>{i.dd}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
