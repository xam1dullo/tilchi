'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function NumCounter({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLElement>(null)

  useGsap(({ gsap, ScrollTrigger }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const el = ref.current
      if (!el) return
      const obj = { n: 0 }
      gsap.to(obj, {
        n: value,
        duration: 1.2,
        ease: 'tilchi',
        scrollTrigger: { trigger: el, start: 'top 88%' },
        onUpdate: () => {
          el.textContent = String(Math.round(obj.n))
        },
      })
    })

    return () => mm.revert()
  }, [value])

  return (
    <dt ref={ref} className={className}>
      {value}
    </dt>
  )
}
