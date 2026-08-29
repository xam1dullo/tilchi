'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { site } from '@/lib/site'

export function Nav() {
  const ref = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const nav = ref.current
    if (!nav) return

    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.nav-links a'))
    const pageLinks = links.filter((a) => !a.getAttribute('href')?.includes('#'))
    pageLinks.forEach((a) => {
      const href = a.getAttribute('href')
      const isCurrent = href === pathname || (href !== '/' && pathname.startsWith(`${href}/`))
      if (isCurrent) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    })

    if (pathname !== '/' || !('IntersectionObserver' in window)) {
      return () => window.removeEventListener('scroll', onScroll)
    }

    const sectionLinks = links.filter((a) => a.getAttribute('href')?.startsWith('/#'))
    const targets = sectionLinks
      .map((a) => document.querySelector(a.getAttribute('href')?.replace(/^\//, '') ?? ''))
      .filter((t): t is Element => t != null)
    if (targets.length === 0) {
      return () => window.removeEventListener('scroll', onScroll)
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const i = targets.indexOf(e.target)
          if (i < 0) return
          sectionLinks.forEach((a) => a.removeAttribute('aria-current'))
          sectionLinks[i].setAttribute('aria-current', 'true')
        })
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )
    targets.forEach((t) => io.observe(t))

    return () => {
      window.removeEventListener('scroll', onScroll)
      io.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      const menu = ref.current?.querySelector('.nav-links')
      if (!menu?.contains(target) && !toggleRef.current?.contains(target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="nav" ref={ref} style={{ viewTransitionName: 'persistent-nav' }}>
      <div className="nav-inner">
        <Link href="/" className="logo" aria-label="Tilchi bosh sahifa" transitionTypes={['nav-lateral']}>
          <span className="logo-mark" aria-hidden="true" />
          <span>tilchi</span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          ref={toggleRef}
          aria-expanded={open}
          aria-controls="nav-links"
          aria-label={open ? 'Menyuni yopish' : 'Menyuni ochish'}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <nav aria-label="Asosiy navigatsiya">
          <ul className={`nav-links${open ? ' open' : ''}`} id="nav-links">
            {site.nav.map((l) => (
              <li key={l.href}>
                {l.href.includes('#') ? (
                  <a href={l.href} onClick={() => setOpen(false)}>
                    {l.label}
                  </a>
                ) : (
                  <Link href={l.href} transitionTypes={['nav-lateral']} onClick={() => setOpen(false)}>
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <a href="/#booking" className="btn btn-primary" onClick={() => setOpen(false)}>
          Bepul demo dars
        </a>
      </div>
    </header>
  )
}
