import type { Metadata } from 'next'
import Link from 'next/link'
import { publishedPosts, formatDate } from '@/lib/posts'
import { Reveal } from '@/components/gsap/Reveal'

export const metadata: Metadata = {
  title: 'Blog',
  description: "O'qituvchi tanlash, IELTS va CEFR tushunchalari, umumiy xatolar — til o'rganish haqida amaliy maqolalar.",
  alternates: { canonical: '/blog/' },
}

export default function BlogPage() {
  return (
    <>
      <section className="blog-header">
        <div className="container">
          <p className="eyebrow">Blog</p>
          <h1 className="h2" style={{ marginTop: 14 }}>
            Til o'rganish haqida <em>adashmagan holda.</em>
          </h1>
          <p className="lede">Sertifikatlar, metodikalar va ko'p so'raladigan savollar — o'qituvchi nuqtai nazaridan.</p>
        </div>
      </section>

      <section className="blog-grid container">
        {publishedPosts.map((post, i) => (
          <Reveal key={post.slug} delay={i * 0.06}>
            <article className="blog-card">
              <time dateTime={post.date} className="num">
                {formatDate(post.date)}
              </time>
              <h2>
                <Link href={post.href}>{post.title}</Link>
              </h2>
              <p>{post.description}</p>
            </article>
          </Reveal>
        ))}
      </section>
    </>
  )
}
