'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useGsap(({ gsap, ScrollTrigger, ScrollSmoother }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const smoother = ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.15,
        smoothTouch: false,
        effects: false,
        normalizeScroll: false,
      })

      const onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null
        const anchor = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
        if (!anchor) return
        const href = anchor.getAttribute('href')
        if (!href || href.length < 2) return
        const el = document.querySelector(href)
        if (!el) return
        e.preventDefault()
        smoother.scrollTo(el, true, 'top 0')
        history.pushState(null, '', href)
      }

      const refresh = () => ScrollTrigger.refresh()

      document.addEventListener('click', onClick)
      document.fonts?.ready.then(refresh)
      window.addEventListener('load', refresh)

      return () => {
        document.removeEventListener('click', onClick)
        window.removeEventListener('load', refresh)
        smoother.kill()
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <div id="smooth-wrapper">
      <div id="smooth-content" ref={ref}>
        {children}
      </div>
    </div>
  )
}
