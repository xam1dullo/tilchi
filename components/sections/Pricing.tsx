import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { fmtPrice, prices, site } from '@/lib/site'

const check = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

export function Pricing() {
  return (
    <section className="section" id="narx">
      <div className="container">
        <div className="sec-intro">
          <p className="eyebrow">Narxlar</p>
          <SplitHeading className="h2">
            Ikki tarif. <em>Yashirin to'lov yo'q.</em>
          </SplitHeading>
          <p className="lede">
            Birinchi oqim uchun maxsus launch narx — chunki siz bizning birinchi o'quvchilarimiz bo'lasiz.
          </p>
        </div>

        <div className="pricing">
          <Reveal>
            <article className="plan plan-popular">
              <div className="plan-head">
                <h3>Guruh</h3>
                <p className="plan-sub num">
                  3–5 kishi · haftada {site.lesson.groupPerWeek} dars · {site.lesson.durationMin} daqiqa
                </p>
              </div>
              <div className="plan-money">
                <p className="plan-old num">{fmtPrice(prices.group.regular)} so'm</p>
                <div className="plan-price">
                  <span className="amount num">{fmtPrice(prices.group.launch)}</span>
                  <span className="cur">so'm</span>
                  <span className="per">/oy</span>
                </div>
                <span className="plan-launch">Launch narx — birinchi oqim</span>
              </div>
              <ul>
                <li>{check} Kichik guruh — har kimga e'tibor yetadi</li>
                <li>{check} Uy vazifasi + tekshirish</li>
                <li>{check} Speaking mashqlari har darsda</li>
              </ul>
              <a href="#booking" className="btn btn-primary">
                Guruhga yozilish
              </a>
              <p className="seats-note">
                Guruhda atigi <strong className="num">{site.cohort.groupSeats}</strong> o'rin — yakka o'qituvchi sig'imi
              </p>
            </article>
          </Reveal>

          <Reveal delay={0.1}>
            <article className="plan">
              <div className="plan-head">
                <h3>Individual</h3>
                <p className="plan-sub num">
                  1-on-1 · haftada {site.lesson.indivPerWeek} dars · {site.lesson.durationMin} daqiqa
                </p>
              </div>
              <div className="plan-money">
                <p className="plan-old num">{fmtPrice(prices.indiv.regular)} so'm</p>
                <div className="plan-price">
                  <span className="amount num">{fmtPrice(prices.indiv.launch)}</span>
                  <span className="cur">so'm</span>
                  <span className="per">/oy</span>
                </div>
                <span className="plan-launch">Launch narx — birinchi oqim</span>
              </div>
              <ul>
                <li>{check} To'liq shaxsiy o'quv rejasi</li>
                <li>{check} Jadval to'liq sizga moslanadi</li>
                <li>
                  {check} IELTS intensiv: haftada 3 dars — <span className="num">+{fmtPrice(prices.ieltsAddon)} so'm</span>
                </li>
              </ul>
              <a href="#booking" className="btn btn-outline">
                Individual tanlash
              </a>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
