'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { site, tgLinkProps } from '@/lib/site'

export function StickyCta() {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const isHome = pathname === '/'

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!isHome) {
      el.classList.add('show')
      return
    }

    if (!('IntersectionObserver' in window)) return

    const hero = document.querySelector('.hero')
    const booking = document.getElementById('booking')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.target === hero) el.classList.toggle('show', !e.isIntersecting)
          if (e.target === booking && e.isIntersecting) el.classList.remove('show')
        })
      },
      { threshold: 0.05 }
    )
    if (hero) io.observe(hero)
    if (booking) io.observe(booking)

    return () => io.disconnect()
  }, [isHome])

  return (
    <div className="sticky-cta" ref={ref}>
      <a {...(isHome ? { href: '/#booking' } : tgLinkProps(site.botUrl))} className="btn btn-primary">
        Bepul demo dars — Telegram'da
      </a>
    </div>
  )
}
