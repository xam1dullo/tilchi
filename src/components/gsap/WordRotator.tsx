'use client'

import { useRef } from 'react'
import { useGsap } from '@/lib/gsap'

export function WordRotator({ words }: { words: readonly string[] }) {
  const ref = useRef<HTMLSpanElement>(null)

  useGsap(({ gsap }) => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('.rotator-item') ?? [])
      if (items.length < 2) return

      const cycle = gsap.timeline({ repeat: -1, delay: 2.2 })
      for (let k = 0; k < items.length; k++) {
        const cur = items[k]
        const nxt = items[(k + 1) % items.length]
        cycle.to(cur, { yPercent: -115, autoAlpha: 0, duration: 0.4, ease: 'tilchi' }, k)
        cycle.fromTo(nxt, { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: 'tilchi' }, k)
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <span className="rotator" ref={ref} aria-label={words[0]}>
      {words.map((w, i) => (
        <span className="rotator-item" key={w} aria-hidden={i !== 0 ? 'true' : undefined}>
          {w}
        </span>
      ))}
    </span>
  )
}
