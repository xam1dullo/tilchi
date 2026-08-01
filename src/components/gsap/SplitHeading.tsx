'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function SplitHeading({
  as: Tag = 'h2',
  className,
  children,
}: {
  as?: 'h2' | 'h3'
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLHeadingElement | null>(null)

  useGsap(({ gsap, ScrollTrigger, SplitText }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const el = ref.current
      if (!el) return
      const split = new SplitText(el, { type: 'lines', linesClass: 'sh-line' })
      gsap.from(split.lines, {
        yPercent: 70,
        opacity: 0,
        stagger: 0.09,
        duration: 0.75,
        ease: 'tilchi',
        scrollTrigger: { trigger: el, start: 'top 84%' },
      })
      return () => split.revert()
    })

    return () => mm.revert()
  }, [])

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}
