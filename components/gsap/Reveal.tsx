'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useGsap(({ gsap, ScrollTrigger }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const el = ref.current
      if (!el) return
      gsap.from(el, {
        y: 26,
        opacity: 0,
        duration: 0.7,
        delay,
        ease: 'tilchi',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      })
    })

    return () => mm.revert()
  }, [delay])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
