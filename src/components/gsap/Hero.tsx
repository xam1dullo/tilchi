'use client'

import { useRef } from 'react'
import { useGsap, loadGsap } from '@/lib/gsap'
import { site, teacher } from '@/lib/site'

const check = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
)

const badge = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

const medal = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.5 13l1.5 8-5-3-5 3 1.5-8" />
  </svg>
)

const book = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const burstRef = useRef<HTMLAnchorElement>(null)

  useGsap(({ gsap, ScrollTrigger, SplitText }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const el = ref.current
      if (!el) return

      const title = el.querySelector('.hero-title')
      const split = title ? new SplitText(title, { type: 'words', wordsClass: 'hw' }) : null

      const tl = gsap.timeline({ defaults: { ease: 'tilchi' } })
      if (split) {
        tl.from(split.words, { yPercent: 120, opacity: 0, stagger: 0.05, duration: 0.7 }, 0)
      }
      tl.from(el.querySelectorAll('[data-reveal]'), { y: 22, opacity: 0, stagger: 0.09, duration: 0.6 }, 0.25)
      tl.from(el.querySelector('.hero-card'), { y: 30, opacity: 0, duration: 0.7 }, 0.45)

      const card = el.querySelector<HTMLElement>('.hero-card')
      const titleEl = el.querySelector<HTMLElement>('.hero-title')
      const copy = el.querySelector<HTMLElement>('.hero-copy')

      const observer = ScrollTrigger.observe({
        target: window,
        type: 'wheel,touch',
        onChangeY: (self) => {
          const v = gsap.utils.clamp(-1, 1, self.velocityY / 2000)
          if (card) gsap.to(card, { y: -v * 18, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
          if (titleEl) gsap.to(titleEl, { y: v * 10, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
          if (copy) gsap.to(copy, { y: v * 6, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
        },
        onStop: () => {
          const settle = { y: 0, duration: 1.2, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' } as const
          if (card) gsap.to(card, settle)
          if (titleEl) gsap.to(titleEl, settle)
          if (copy) gsap.to(copy, settle)
        },
      })

      return () => {
        observer.kill()
        split?.revert()
      }
    })

    return () => mm.revert()
  }, [])

  const burst = () => {
    const btn = burstRef.current
    if (!btn) return
    loadGsap().then(({ gsap }) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const rect = btn.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const colors = ['#C8593E', '#A8452E', '#F0D9CE', '#F5EFE4', '#171512']
      const parts: HTMLElement[] = []
      for (let i = 0; i < 16; i++) {
        const p = document.createElement('span')
        p.className = 'burst'
        p.style.left = `${x}px`
        p.style.top = `${y}px`
        p.style.background = colors[i % colors.length]
        document.body.appendChild(p)
        parts.push(p)
      }
      gsap.to(parts, {
        duration: 1.6,
        ease: 'none',
        physics2D: {
          velocity: gsap.utils.random(140, 420),
          angle: gsap.utils.random(-160, -20),
          gravity: 500,
          friction: 0.06,
        },
        rotation: gsap.utils.random(-220, 220),
        scale: gsap.utils.random(0.4, 1),
        opacity: 0,
        onComplete: () => parts.forEach((p) => p.remove()),
      })
    })
  }

  return (
    <section className="hero" ref={ref}>
      <div className="container">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow" data-reveal>
              {site.cohort.label}
            </p>
            <h1 className="hero-title">
              <span style={{ display: 'block' }}>Ingliz tilini</span>
              <span style={{ display: 'block' }}>
                <em>haqiqiy o'qituvchi</em> bilan,
              </span>
              <span style={{ display: 'block' }}>
                <span className="u">to'g'ri</span> o'rganing.
              </span>
            </h1>
            <p className="hero-sub" data-reveal>
              <strong>{teacher.name}</strong> — CELTA sertifikatli o'qituvchi bilan online darslar. Bolalar, IELTS va
              kattalar uchun alohida dastur. <strong>Birinchi dars — bepul.</strong>
            </p>
            <div className="cred-strip" data-reveal role="list" aria-label="O'qituvchi malakalari">
              <span className="cred" role="listitem">
                {check} <span>{teacher.cert}</span>
              </span>
              <span className="cred num" role="listitem">
                {badge} IELTS <span>{teacher.ielts}</span>
              </span>
              <span className="cred" role="listitem">
                {medal} CEFR <span>{teacher.cefr}</span>
              </span>
              <span className="cred" role="listitem">
                {book} Magistr
              </span>
            </div>
            <div className="hero-ctas" data-reveal>
              <a href="#booking" className="btn btn-primary" ref={burstRef} onClick={burst}>
                Bepul demo darsni band qilish
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a href="#dastur" className="btn-text">
                Dasturni ko'rish
              </a>
            </div>
          </div>

          <div className="hero-card" id="oqituvchi">
            <span className="hc-badge">Sizning o'qituvchingiz</span>
            <div className="hc-top">
              <span className="hc-avatar">
                <span aria-hidden="true">{teacher.initials}</span>
              </span>
              <div>
                <div className="hc-name">{teacher.name}</div>
                <div className="hc-role">{teacher.jobTitle}</div>
              </div>
            </div>
            <ul className="hc-facts">
              <li>
                {check} <span>
                  <strong>{teacher.cert}</strong> — Cambridge o'qitish sertifikati
                </span>
              </li>
              <li className="num">
                {badge} <span>
                  IELTS <strong>{teacher.ielts}</strong> · CEFR <strong>{teacher.cefr}</strong>
                </span>
              </li>
              <li>
                {book} <span>{teacher.degree}</span>
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>{' '}
                <span>
                  <strong>{teacher.experience}</strong> o'qitish tajribasi
                </span>
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>{' '}
                <span>{teacher.research}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
