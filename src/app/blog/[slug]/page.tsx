import type { Metadata } from 'next'
import Link from 'next/link'
import { ViewTransition } from 'react'
import { notFound } from 'next/navigation'
import { getPost, publishedPosts, formatDate } from '@/lib/posts'
import { MdxContent } from '@/components/MdxContent'
import { JsonLd } from '@/components/JsonLd'
import { PageTransition } from '@/components/PageTransition'
import { articleLd } from '@/lib/seo'
import { site, tgLinkProps } from '@/lib/site'
import { Footer } from '@/components/Footer'

export const dynamicParams = false

export async function generateStaticParams() {
  return publishedPosts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${post.href}/` },
    openGraph: {
      type: 'article',
      publishedTime: post.date,
      title: post.title,
      description: post.description,
      images: [{ url: `/og/${post.slug}.png`, width: 1200, height: 630 }],
    },
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <PageTransition>
      <article>
        <JsonLd data={articleLd(post)} />
      <header className="article-header">
        <div className="container">
          <Link href="/blog" className="article-back" transitionTypes={['nav-back']}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Barcha maqolalar
          </Link>
          <time dateTime={post.date} className="num">
            {formatDate(post.date)}
          </time>
          <ViewTransition name={`title-${post.slug}`} share="text-morph" default="none">
            <h1 className="article-title">{post.title}</h1>
          </ViewTransition>
          <p className="article-lead">{post.description}</p>
        </div>
      </header>

      <div className="container article">
        <MdxContent code={post.content} />
        <aside className="article-cta">
          <h3>Bu maqola sizga foydali bo'ldimi?</h3>
          <p>
            Bepul demo darsda o'z darajangizni aniqlang — suhbat asosida, test to'ldirmasdan.
          </p>
          <a {...tgLinkProps(site.botUrl)} className="btn btn-primary">
            Telegram'da davom etish
          </a>
</aside>
      </div>
      </article>
      <Footer />
    </PageTransition>
  )
}
