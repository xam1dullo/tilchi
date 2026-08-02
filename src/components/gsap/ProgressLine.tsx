'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function ProgressLine() {
  const ref = useRef<HTMLDivElement>(null)

  useGsap(({ gsap, ScrollTrigger }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const el = ref.current
      if (!el) return
      gsap.fromTo(
        el,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          transformOrigin: 'left center',
          scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 25%', scrub: 0.5 },
        }
      )
    })

    return () => mm.revert()
  }, [])

  return <div className="progress-line" ref={ref} aria-hidden="true" />
}
