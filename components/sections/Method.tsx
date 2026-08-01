import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { site } from '@/lib/site'

const steps = [
  {
    n: '01',
    title: "Telegram'da yoziling",
    desc: "Pastdagi tugma orqali botga o'tasiz — segment va darajangizni tanlaysiz, bot qolganini so'raydi.",
    time: '~2 daqiqa',
  },
  {
    n: '02',
    title: 'Bepul demo dars',
    desc: "O'qituvchi bilan tanishasiz, darajangiz aniqlanadi va sizga mos reja tuziladi. Majburiyatsiz.",
    time: '30 daqiqa · Zoom',
  },
  {
    n: '03',
    title: 'Darslar boshlanadi',
    desc: "Guruh yoki individual formatni tanlaysiz — jadval sizning vaqtingizga moslanadi.",
    time: site.cohort.label,
  },
]

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
          {steps.map((s) => (
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
