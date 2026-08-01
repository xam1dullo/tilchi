import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="section" style={{ textAlign: 'center' }}>
      <div className="container">
        <p className="eyebrow" style={{ justifyContent: 'center' }}>
          Xato 404
        </p>
        <h1 className="h2" style={{ marginTop: 14 }}>
          Bunday sahifa <em>yo'q.</em>
        </h1>
        <p className="lede" style={{ margin: '18px auto 0', maxWidth: 44 }}>
          Havola eskirgan yoki sahifa ko'chirilgan bo'lishi mumkin.
        </p>
        <div style={{ marginTop: 30 }}>
          <Link href="/" className="btn btn-primary">
            Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </section>
  )
}
