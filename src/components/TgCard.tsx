'use client'

import { useMemo, useState } from 'react'
import { Magnetic } from '@/components/gsap/Magnetic'
import { botLink } from '@/lib/site'

const segs = [
  { value: 'bolalar', label: 'Bolalar' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'kattalar', label: 'Kattalar' },
] as const

const lvs = [
  { value: 'boshlovchi', label: 'Boshlovchi' },
  { value: 'orta', label: "O'rta" },
  { value: 'bilmayman', label: 'Bilmayman' },
] as const

const tg = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.557 1.725.264 1.998-.937l3.622-16.972.001-.001c.321-1.498-.541-2.084-1.527-1.717L2.29 9.858c-1.457.563-1.436 1.374-.249 1.741l5.409 1.687L19.98 6.076c.586-.386 1.119-.174.68.213L9.417 15.181z" />
  </svg>
)

export function TgCard() {
  const [seg, setSeg] = useState('ielts')
  const [lv, setLv] = useState('bilmayman')

  const href = useMemo(() => botLink(seg, lv), [seg, lv])

  return (
    <div className="tg-card">
      <p className="tg-card-title">Demo darsga yozilish</p>
      <p className="tg-card-sub">Tanlovingiz botga avtomatik uzatiladi</p>

      <span className="tg-label" id="seg-label">
        Kim uchun?
      </span>
      <div className="choice-grid" role="radiogroup" aria-labelledby="seg-label">
        {segs.map((s) => (
          <label className="choice" key={s.value}>
            <input type="radio" name="seg" value={s.value} checked={seg === s.value} onChange={() => setSeg(s.value)} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>

      <span className="tg-label" id="lv-label">
        Darajangiz (taxminan)
      </span>
      <div className="choice-grid" role="radiogroup" aria-labelledby="lv-label">
        {lvs.map((s) => (
          <label className="choice" key={s.value}>
            <input type="radio" name="lv" value={s.value} checked={lv === s.value} onChange={() => setLv(s.value)} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>

      <Magnetic>
        <a href={href} className="btn btn-tg" rel="noopener">
          {tg}
          Telegram'da davom etish
        </a>
      </Magnetic>
      <p className="tg-hint">
        Bot: <a className="tg-bot-link" href={botLink(seg, lv)}>@tilchiuz_bot</a>
      </p>
    </div>
  )
}
