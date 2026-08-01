'use client'

import { useEffect, useRef } from 'react'
import { site } from '@/lib/site'

export function Nav() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = ref.current
    if (!nav) return

    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    if (!('IntersectionObserver' in window)) return

    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.nav-links a[href^="#"]'))
    const targets = links
      .map((a) => document.querySelector(a.getAttribute('href') ?? ''))
      .filter((t): t is Element => t != null)
    if (targets.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const i = targets.indexOf(e.target)
          if (i < 0) return
          links.forEach((a) => a.removeAttribute('aria-current'))
          links[i].setAttribute('aria-current', 'true')
        })
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )
    targets.forEach((t) => io.observe(t))

    return () => {
      window.removeEventListener('scroll', onScroll)
      io.disconnect()
    }
  }, [])

  return (
    <header className="nav" ref={ref}>
      <div className="nav-inner">
        <a href="/" className="logo" aria-label="Tilchi bosh sahifa">
          <span className="logo-mark" aria-hidden="true" />
          <span>tilchi</span>
        </a>
        <nav aria-label="Asosiy navigatsiya">
          <ul className="nav-links">
            {site.nav.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <a href="#booking" className="btn btn-primary">
          Bepul demo dars
        </a>
      </div>
    </header>
  )
}
