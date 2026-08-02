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
        <ProgressLine />
        <div className="demo-grid">
          {demoSteps.map((i) => (
            <Reveal key={i.n}>
              <div className="demo-item">
                <span className="n" aria-hidden="true">
                  {i.n}
                </span>
                <div>
                  <h3>{i.title}</h3>
                  <p>{i.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
