import { Reveal } from '@/components/gsap/Reveal'

const items = [
  { dt: 'Bepul', dd: "Birinchi demo dars. Karta ham, oldindan to'lov ham so'ralmaydi." },
  { dt: '5', dd: "Guruhdagi maksimal o'rin — yakka o'qituvchining haqiqiy sig'imi.", num: true },
  { dt: '12 soat', dd: "Shuncha oldin ogohlantirsangiz, dars bepul ko'chiriladi." },
  { dt: 'Shartnomasiz', dd: "Oylik to'lov. Istagan oyda to'xtatasiz, jarima yo'q." },
]

export function TrustBand() {
  return (
    <section className="trust" aria-label="Nega ishonish mumkin">
      <div className="container">
        <Reveal>
          <dl className="trust-inner">
            {items.map((i) => (
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
