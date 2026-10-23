import Link from 'next/link'
import { site, tgLinkProps } from '@/lib/site'

const tg = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.557 1.725.264 1.998-.937l3.622-16.972.001-.001c.321-1.498-.541-2.084-1.527-1.717L2.29 9.858c-1.457.563-1.436 1.374-.249 1.741l5.409 1.687L19.98 6.076c.586-.386 1.119-.174.68.213L9.417 15.181z" />
  </svg>
)

export function Footer() {
  return (
    <footer className="footer footer-rich">
      <div className="container footer-inner">
        <div className="footer-top">
          <Link href="/" className="logo footer-logo" aria-label="Tilchi" transitionTypes={['nav-lateral']}>
            <span className="logo-mark" aria-hidden="true" />
            <span>tilchi</span>
          </Link>
          <nav className="footer-nav" aria-label="Havolalar">
            <a href="/#programs">Darslar</a>
            <Link href="/teacher" transitionTypes={['nav-lateral']}>
              O'qituvchi
            </Link>
            <a href="/#faq">Savollar</a>
            <Link href="/blog" transitionTypes={['nav-lateral']}>
              Blog
            </Link>
            <a href="https://app.tilchi.uz" target="_blank" rel="noopener noreferrer">
              Sinfxona<span aria-hidden="true"> ↗</span>
            </a>
          </nav>
        </div>
        <div className="footer-bottom">
          <a {...tgLinkProps()} className="tg-link">
            {tg}
            <span>@{site.telegramBot}</span>
          </a>
          <p className="footer-note num">© 2026 tilchi.uz</p>
        </div>
        <p className="footer-giant" aria-hidden="true">
          tilchi
        </p>
      </div>
    </footer>
  )
}
