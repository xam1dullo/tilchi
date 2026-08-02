'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function Magnetic({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useGsap(({ gsap }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference) and (hover: hover)', () => {
      const el = ref.current
      if (!el) return
      const xTo = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power2.out' })
      const yTo = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power2.out' })

      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect()
        xTo((e.clientX - (r.left + r.width / 2)) * 0.25)
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35)
      }
      const leave = () => {
        xTo(0)
        yTo(0)
      }

      el.addEventListener('pointermove', move)
      el.addEventListener('pointerleave', leave)
      return () => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerleave', leave)
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <div ref={ref} className={className} style={{ display: 'inline-block' }}>
      {children}
    </div>
  )
}
