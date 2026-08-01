import { posts } from '@velite/index'

export const publishedPosts = posts
  .filter((p) => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date))

export const getPost = (slug: string) => publishedPosts.find((p) => p.slug === slug)

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d}-${MONTHS[m - 1]}, ${y}`
}
