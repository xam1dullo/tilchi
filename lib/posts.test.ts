import { describe, expect, it } from 'vitest'
import { formatDate, getPost, publishedPosts } from './posts'

describe('publishedPosts', () => {
  it('excludes drafts and sorts by date, newest first', () => {
    expect(publishedPosts.map((p) => p.slug)).toEqual(['5-xato', 'ielts-cefr', 'celta'])
    expect(publishedPosts.every((p) => !p.draft)).toBe(true)
  })

  it('hides a draft post even when it is the newest by date', () => {
    expect(publishedPosts.some((p) => p.slug === '2026-08-20-qoralama')).toBe(false)
  })
})

describe('getPost', () => {
  it('returns the post for an existing slug', () => {
    expect(getPost('celta')?.title).toContain('CELTA')
  })

  it('returns undefined for an unknown slug', () => {
    expect(getPost('bunday-post-yoq')).toBeUndefined()
  })

  it('returns undefined for a draft post slug', () => {
    expect(getPost('2026-08-20-qoralama')).toBeUndefined()
  })
})

describe('formatDate', () => {
  it('formats an ISO date in Uzbek long form', () => {
    expect(formatDate('2026-08-10')).toBe('10-avgust, 2026')
  })
})
