import type { Metadata } from 'next'
import Link from 'next/link'
import { ViewTransition } from 'react'
import { publishedPosts, formatDate } from '@/lib/posts'
import { PageTransition } from '@/components/PageTransition'
import { Reveal } from '@/components/gsap/Reveal'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Blog',
  description: "O'qituvchi tanlash, IELTS va CEFR tushunchalari, umumiy xatolar — til o'rganish haqida amaliy maqolalar.",
  alternates: { canonical: '/blog/' },
}

export default function BlogPage() {
  return (
    <PageTransition>
      <section className="blog-header">
        <div className="container">
          <p className="eyebrow">Blog</p>
          <h1 className="h2 blog-title">
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
              <ViewTransition name={`title-${post.slug}`} share="text-morph" default="none">
                <h2>
                  <Link href={post.href} transitionTypes={['nav-forward']}>
                    {post.title}
                  </Link>
                </h2>
              </ViewTransition>
              <p>{post.description}</p>
            </article>
          </Reveal>
        ))}
      </section>
      <Footer />
    </PageTransition>
  )
}
