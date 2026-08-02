import { Reveal } from '@/components/gsap/Reveal'
import { NumCounter } from '@/components/gsap/NumCounter'
import { trustItems } from '@/lib/domain/trust'

export function TrustBand() {
  return (
    <section className="trust" aria-label="Nega ishonish mumkin">
      <div className="container">
        <Reveal>
          <dl className="trust-inner">
            {trustItems.map((i) =>
              i.num ? (
                <div className="trust-item" key={i.dt}>
                  <NumCounter value={Number(i.dt)} className="num" />
                  <dd>{i.dd}</dd>
                </div>
              ) : (
                <div className="trust-item" key={i.dt}>
                  <dt className={i.num ? 'num' : ''}>{i.dt}</dt>
                  <dd>{i.dd}</dd>
                </div>
              )
            )}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
