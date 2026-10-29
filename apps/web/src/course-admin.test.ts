import { describe, expect, it } from 'vitest'
import { courseFormData } from './routes/app/courses'

describe('course form', () => {
  const form = () => {
    const data = new FormData()
    data.set('title', ' English ')
    data.set('description', ' Learn English ')
    data.set('segment', 'kattalar')
    data.set('level', 'orta')
    return data
  }
  it('submits trimmed content as a draft unless published is selected', () => {
    const data = form()
    expect(courseFormData(data)).toEqual({
      title: 'English',
      description: 'Learn English',
      segment: 'kattalar',
      level: 'orta',
      published: false,
    })
    data.set('published', 'on')
    expect(courseFormData(data)?.published).toBe(true)
  })
  it('rejects blank content and unrecognized registration payloads', () => {
    const data = form()
    data.set('title', '   ')
    expect(courseFormData(data)).toBeNull()
    data.set('title', 'English')
    data.set('segment', 'unknown')
    expect(courseFormData(data)).toBeNull()
  })
})
