'use client'

import { useRef } from 'react'
import { useGsap, loadGsap } from '@/lib/gsap'
import { Magnetic } from '@/components/gsap/Magnetic'
import { WordRotator } from '@/components/gsap/WordRotator'
import { site, teacher } from '@/lib/site'

const ROTATING_WORDS = [
  'haqiqiy',
  'chinakam',
  'malakali',
  'tajribali',
  'mohir',
  'ishonchli',
  'samimiy',
  'jonkuyar',
  'natijali',
  'zamonaviy',
  "ilg'or",
  'sabrli',
  'talabchan',
  'asl',
  'bilimdon',
  'sinchkov',
  'fidoyi',
  'halol',
] as const

const arrow = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
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
      const split = title ? new SplitText(title, { type: 'words', wordsClass: 'hw', exclude: '.u' }) : null

      const tl = gsap.timeline({ defaults: { ease: 'tilchi' } })
      if (split) {
        tl.from(split.words, { yPercent: 120, opacity: 0, stagger: 0.05, duration: 0.7 }, 0)
      }
      tl.from(el.querySelectorAll('[data-reveal]'), { y: 22, opacity: 0, stagger: 0.09, duration: 0.6 }, 0.25)
      tl.from(el.querySelector('.hero-portrait'), { y: 30, opacity: 0, duration: 0.7 }, 0.45)

      const uWord = el.querySelector<HTMLElement>('.hero-title .u')
      if (uWord) {
        tl.to(
          uWord,
          { scrambleText: { text: "to'g'ri", chars: "to'gri#?", speed: 0.8 }, duration: 1.3, ease: 'none' },
          1.15,
        )
      }
      const stroke = el.querySelector('.u-stroke path')
      if (stroke) tl.to(stroke, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' }, 2.3)
      tl.from(el.querySelectorAll('.float-card'), { opacity: 0, scale: 0.92, stagger: 0.12, duration: 0.6 }, 0.85)

      // Scroll parallax; cards keep their CSS `rotate` since GSAP only writes `transform`.
      const scrub = () => ({ trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 })
      gsap.to(el.querySelector('.hero-glow'), { yPercent: -12, ease: 'none', scrollTrigger: scrub() })
      gsap.to(el.querySelector('.float-a'), { y: -34, ease: 'none', scrollTrigger: scrub() })
      gsap.to(el.querySelector('.float-b'), { y: 22, ease: 'none', scrollTrigger: scrub() })

      const portrait = el.querySelector<HTMLElement>('.hero-portrait')
      const titleEl = el.querySelector<HTMLElement>('.hero-title')
      const lead = el.querySelector<HTMLElement>('.hero-lead')

      const observer = ScrollTrigger.observe({
        target: window,
        type: 'wheel,touch',
        onChangeY: (self) => {
          const v = gsap.utils.clamp(-1, 1, self.velocityY / 2000)
          if (portrait) gsap.to(portrait, { y: -v * 18, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
          if (titleEl) gsap.to(titleEl, { y: v * 10, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
          if (lead) gsap.to(lead, { y: v * 6, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
        },
        onStop: () => {
          const settle = { y: 0, duration: 1.2, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' } as const
          if (portrait) gsap.to(portrait, settle)
          if (titleEl) gsap.to(titleEl, settle)
          if (lead) gsap.to(lead, settle)
        },
      })

      return () => {
        observer.kill()
        split?.revert()
      }
    })

    // Pin-scrub only on desktop: on phones it just adds a blank gap after the portrait.
    mm.add('(min-width: 921px) and (prefers-reduced-motion: no-preference)', () => {
      const el = ref.current
      const grid = el?.querySelector<HTMLElement>('.hero-grid')
      if (!el || !grid) return
      gsap
        .timeline({
          scrollTrigger: { trigger: el, start: 'top top', end: '+=15%', scrub: true, pin: true, anticipatePin: 1 },
        })
        .to(grid, { yPercent: -14, ease: 'none' }, 0)
        .to(el.querySelector('.hero-eyebrow'), { opacity: 0.15, ease: 'none' }, 0)
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
      const colors = ['#175A3B', '#1E6B47', '#E1EEE4', '#FCFCFA', '#151A17']
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
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-ruled" aria-hidden="true" />
      <div className="hero-margin" aria-hidden="true" />
      <div className="container">
        <div className="hero-grid">
          <p className="eyebrow hero-eyebrow" data-reveal>
            {site.cohort.label}
          </p>
          <h1 className="hero-title">
            <span>Ingliz tilini</span>
            <span>
              <em>
                <WordRotator words={ROTATING_WORDS} /> o'qituvchi
              </em>{' '}
              bilan,
            </span>
            <span>
              <span className="u-wrap">
                <span className="u">to'g'ri</span>
                <svg className="u-stroke" viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M3 15 C 45 7, 95 5, 150 10 S 190 16, 197 12" pathLength="1" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
                </svg>
              </span>{' '}
              o'rganing.
            </span>
          </h1>

          <div className="hero-lead">
            <p className="hero-sub" data-reveal>
              <strong>{teacher.name}</strong> — IELTS 7.0, C1 darajali o'qituvchi bilan online darslar. Bolalar, IELTS va
              kattalar uchun alohida dastur. <strong>Birinchi dars — bepul.</strong>
            </p>
            <div className="hero-ctas" data-reveal>
              <Magnetic>
                <a href="#booking" className="btn btn-primary" ref={burstRef} onClick={burst}>
                  Bepul demo darsni band qilish
                  {arrow}
                </a>
              </Magnetic>
              <a href="#programs" className="btn-text">
                Dasturni ko'rish
              </a>
            </div>
            <ul className="rows hero-facts" data-reveal aria-label="O'qituvchi malakalari">
              <li className="row num">
                IELTS <strong>{teacher.ielts}</strong>
              </li>
              <li className="row">
                CEFR <strong>{teacher.cefr}</strong>
              </li>
              <li className="row">{teacher.degree}</li>
              <li className="row">
                <strong>{teacher.experience}</strong> o'qitish tajribasi
              </li>
            </ul>
            <a href="/teacher" className="btn-text hero-teacher-link" data-reveal>
              To'liq professional profilni ko'rish
              {arrow}
            </a>
          </div>

          <div className="hero-figure">
            <div className="hero-portrait" id="teacher">
              <span className="tag hero-portrait-tag">Sizning o'qituvchingiz</span>
              {teacher.photo ? (
                <img src={teacher.photo} alt={teacher.name} width={800} height={1000} fetchPriority="high" />
              ) : (
                <div className="portrait-fallback">
                  <span className="portrait-initials" aria-hidden="true">
                    {teacher.initials}
                  </span>
                  <div className="portrait-caption">
                    <strong>{teacher.name}</strong>
                    <span className="num">
                      IELTS {teacher.ielts} · {teacher.cefr}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="float-card float-a" aria-hidden="true">
              <span className="stat num">{teacher.ielts}</span>
              <span>IELTS Academic</span>
            </div>
            <div className="float-card float-b" aria-hidden="true">
              <span className="stat num">{teacher.cefr}</span>
              <span>CEFR daraja</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
