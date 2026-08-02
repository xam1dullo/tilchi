'use client'

import { createElement, useRef, type Ref } from 'react'
import { useGsap } from '@/lib/gsap'

export function ScrubSection({
  children,
  className,
  as: Tag = 'section',
  y = 40,
  id,
}: {
  children: React.ReactNode
  className?: string
  as?: 'section' | 'div'
  y?: number
  id?: string
}) {
  const ref = useRef<HTMLElement | null>(null)

  useGsap(({ gsap, ScrollTrigger }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const el = ref.current
      if (!el) return
      gsap.fromTo(
        el,
        { y },
        {
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'top top',
            scrub: 0.6,
          },
        }
      )
    })

    return () => mm.revert()
  }, [])

  return createElement(
    Tag,
    { ref: ref as Ref<HTMLElement>, className, id },
    children
  )
}
