import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { methodSteps } from '@/content/sections'

export function Method() {
  return (
    <section className="section metod" id="metodika">
      <div className="container">
        <div className="sec-intro">
          <p className="eyebrow">Qanday ishlaydi</p>
          <SplitHeading className="h2">
            Uch qadam — <em>ortiqcha byurokratiyasiz.</em>
          </SplitHeading>
        </div>
        <div className="steps">
          {methodSteps.map((s) => (
            <Reveal key={s.n}>
              <div className="step">
                <div className="step-num num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="step-time num">{s.time}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
