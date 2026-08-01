import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { TgCard } from '@/components/TgCard'

const check = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

export function Booking() {
  return (
    <section className="section booking" id="booking">
      <div className="container">
        <div className="booking-grid">
          <div className="booking-copy">
            <p className="eyebrow">Bepul demo dars</p>
            <SplitHeading as="h2">
              Bir tugma — <em>qolganini bot so'raydi.</em>
            </SplitHeading>
            <p>
              Telefon raqam yozish, forma to'ldirish shart emas. Telegram botga o'tasiz — u sizdan qulay vaqtni so'raydi
              va demo darsni belgilaydi.
            </p>
            <ul>
              <li>{check} 30 daqiqalik jonli demo dars — bepul</li>
              <li>{check} Karta so'ralmaydi, majburiyat yo'q</li>
              <li>{check} Javob odatda bir necha soat ichida</li>
            </ul>
          </div>

          <Reveal delay={0.1}>
            <TgCard />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
