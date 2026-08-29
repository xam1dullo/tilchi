import Link from 'next/link'
import { PageTransition } from '@/components/PageTransition'
import { Footer } from '@/components/Footer'

export default function NotFound() {
  return (
    <PageTransition>
      <section className="section not-found">
        <div className="container">
          <p className="eyebrow">
            Xato 404
          </p>
          <h1 className="h2">
            Bunday sahifa <em>yo'q.</em>
          </h1>
          <p className="lede">
            Havola eskirgan yoki sahifa ko'chirilgan bo'lishi mumkin.
          </p>
          <div className="not-found-cta">
            <Link href="/" className="btn btn-primary" transitionTypes={['nav-lateral']}>
              Bosh sahifaga qaytish
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </PageTransition>
  )
}
