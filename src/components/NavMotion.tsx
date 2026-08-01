'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function NavMotion() {
  const barRef = useRef<HTMLDivElement>(null)

  useGsap(({ gsap, ScrollTrigger }) => {
    const mm = gsap.matchMedia()
    const bar = barRef.current

    if (bar) {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          bar,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
          }
        )
      })
    }

    mm.add('(min-width: 781px) and (prefers-reduced-motion: no-preference)', () => {
      const nav = document.querySelector<HTMLElement>('.nav')
      if (!nav) return
      const ob = ScrollTrigger.observe({
        target: window,
        type: 'wheel,touch',
        onDown: () => {
          if (window.scrollY > 160) nav.classList.add('nav-hidden')
        },
        onUp: () => nav.classList.remove('nav-hidden'),
      })
      return () => ob.kill()
    })

    return () => mm.revert()
  }, [])

  return <div className="nav-progress" ref={barRef} aria-hidden="true" />
}
