import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { methodSteps } from '@/lib/domain/method'

export function Method() {
  return (
    <section className="section method" id="method">
      <div className="container">
        <div className="sec-intro">
          <p className="eyebrow">Qanday ishlaydi</p>
          <SplitHeading className="h2">
            Uch qadam — <em>ortiqcha byurokratiyasiz.</em>
          </SplitHeading>
        </div>
        <div className="steps">
          {methodSteps.map((s) => (
            <Reveal key={s.n} className="step">
              <div className="step-num stat num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <div className="step-time num">— {s.time}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
