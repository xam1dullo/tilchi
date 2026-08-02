'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function ScrubList({
  children,
  className,
  x = 70,
}: {
  children: React.ReactNode
  className?: string
  x?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useGsap(({ gsap, ScrollTrigger }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const el = ref.current
      if (!el) return
      gsap.fromTo(
        el.children,
        { x, opacity: 0.35 },
        {
          x: 0,
          opacity: 1,
          ease: 'none',
          stagger: 0.14,
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'top 30%', scrub: 0.6 },
        }
      )
    })

    return () => mm.revert()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
