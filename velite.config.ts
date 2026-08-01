import { basename } from 'node:path'
import { defineConfig, s } from 'velite'

export default defineConfig({
  root: 'content',
  output: {
    data: '.velite',
    assets: 'public/static',
    base: '/static/',
    name: '[name]-[hash:6].[ext]',
    clean: true,
  },
  collections: {
    posts: {
      name: 'Post',
      pattern: 'posts/*.mdx',
      schema: s
        .object({
          title: s.string(),
          description: s.string(),
          date: s.isodate(),
          draft: s.boolean().default(false),
          content: s.mdx(),
        })
        .transform((data, { meta }) => {
          const slug = basename(meta.path).replace(/\.mdx$/, '')
          return { ...data, slug, href: `/blog/${slug}` }
        }),
    },
  },
})
