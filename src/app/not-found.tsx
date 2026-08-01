import Link from 'next/link'

export default function NotFound() {
  return (
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
          <Link href="/" className="btn btn-primary">
            Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </section>
  )
}
