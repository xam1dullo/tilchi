import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { ProgressLine } from '@/components/gsap/ProgressLine'
import { demoSteps } from '@/lib/domain/demo'

export function Demo() {
  return (
    <section className="section" id="demo">
      <div className="container">
        <div className="sec-intro">
          <p className="eyebrow">Bepul demo dars</p>
          <SplitHeading className="h2">
            30 daqiqada <em>aniq nima bo'ladi.</em>
          </SplitHeading>
          <p className="lede">Hech qanday sotuv bosimi yo'q. Sizga mos kelmasa — buni ochiq aytamiz.</p>
        </div>
        <div className="agenda-head num" aria-hidden="true">
          <span>0 daq.</span>
          <span>30 daq.</span>
        </div>
        <div className="agenda-track">
          <ProgressLine />
        </div>
        <div className="agenda rows">
          {demoSteps.map((i) => (
            <Reveal key={i.n} className="agenda-item row">
              <span className="n" aria-hidden="true">
                {i.n}
              </span>
              <h3>{i.title}</h3>
              <p>{i.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
