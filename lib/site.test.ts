import { describe, expect, it } from 'vitest'
import { botLink, fmtPrice } from './site'

describe('fmtPrice', () => {
  it('groups thousands with non-breaking spaces', () => {
    expect(fmtPrice(250000)).toBe('250\u00A0000')
    expect(fmtPrice(450000)).toBe('450\u00A0000')
    expect(fmtPrice(1000)).toBe('1\u00A0000')
  })
})

describe('botLink', () => {
  it('builds a start-payload deep link', () => {
    expect(botLink('ielts', 'orta')).toBe('https://t.me/tilchiuz_bot?start=ielts_orta')
  })

  it('strips characters that are not A-Z a-z 0-9 _ -', () => {
    expect(botLink("o'zbek", 'boshlovchi')).toBe('https://t.me/tilchiuz_bot?start=ozbek_boshlovchi')
  })

  it('falls back to the bare bot link when the payload is empty', () => {
    expect(botLink('!!!', '???')).toBe('https://t.me/tilchiuz_bot')
  })

  it('does not leave a dangling underscore when one part is empty', () => {
    expect(botLink('', 'orta')).toBe('https://t.me/tilchiuz_bot?start=orta')
    expect(botLink('ielts', '')).toBe('https://t.me/tilchiuz_bot?start=ielts')
  })

  it('truncates the payload to 64 characters', () => {
    const long = 'a'.repeat(40)
    const link = botLink(long, long)
    expect(link).toBe(`https://t.me/tilchiuz_bot?start=${'a'.repeat(40)}_${'a'.repeat(23)}`)
  })
})
