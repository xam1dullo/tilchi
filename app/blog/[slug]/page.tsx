import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost, publishedPosts, formatDate } from '@/lib/posts'
import { MdxContent } from '@/components/MdxContent'
import { JsonLd } from '@/components/JsonLd'
import { articleLd } from '@/lib/seo'
import { site } from '@/lib/site'

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
    },
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <article>
      <JsonLd data={articleLd(post)} />
      <header className="article-header">
        <div className="container">
          <Link href="/blog" className="article-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Barcha maqolalar
          </Link>
          <time dateTime={post.date} className="num">
            {formatDate(post.date)}
          </time>
          <h1 className="article-title">{post.title}</h1>
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
          <a href={site.botUrl} className="btn btn-primary" rel="noopener">
            Telegram'da davom etish
          </a>
        </aside>
      </div>
    </article>
  )
}
