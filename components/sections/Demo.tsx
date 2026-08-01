import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'

const items = [
  { n: '1', title: 'Qisqa tanishuv', desc: "Nima uchun ingliz tili kerakligini so'raymiz — imtihon, ish, safar yoki bola uchunmi." },
  { n: '2', title: 'Daraja aniqlanadi', desc: "Jonli suhbat orqali CEFR bo'yicha taxminiy darajangiz belgilanadi. Test to'ldirmaysiz." },
  { n: '3', title: 'Haqiqiy mashq', desc: "Bir necha daqiqa real dars formatida ishlaymiz — uslub sizga to'g'ri kelishini ko'rasiz." },
  { n: '4', title: 'Reja va narx', desc: "Sizga mos format, haftalik jadval va aniq oylik summa aytiladi. Yashirin to'lov yo'q." },
]

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
        <div className="demo-grid">
          {items.map((i) => (
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
