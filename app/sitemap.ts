import type { MetadataRoute } from 'next'
import { publishedPosts } from '@/lib/posts'
import { site } from '@/lib/site'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/', '/blog', ...publishedPosts.map((p) => p.href)]
  return routes.map((r) => ({
    url: `${site.url}${r === '/' ? '/' : `${r}/`}`,
    lastModified: new Date(),
    changeFrequency: r === '/' ? 'monthly' : 'weekly',
    priority: r === '/' ? 1 : r === '/blog' ? 0.8 : 0.7,
  }))
}
