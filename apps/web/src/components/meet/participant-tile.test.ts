import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { copy } from '../../lib/i18n'
import type { MediaHandle, Peer } from '../../lib/meet'
import { ParticipantTile } from './participant-tile'

const en = copy.en

const track = (): MediaHandle => ({
  attach: () => undefined,
  detach: () => undefined,
})

const peer = (over: Partial<Peer> = {}): Peer => ({
  id: 'u1',
  name: 'Ada Lovelace',
  local: false,
  speaking: false,
  micOn: true,
  video: null,
  audio: null,
  ...over,
})

const render = (tile: Peer) =>
  renderToStaticMarkup(createElement(ParticipantTile, { tile, copy: en }))

describe('ParticipantTile media', () => {
  it('renders a muted, inline video for a live camera and no avatar', () => {
    const html = render(peer({ video: track() }))
    expect(html).toMatch(/<video[^>]*class="meet-video"/)
    expect(html).toMatch(/<video[^>]*autoplay/i)
    expect(html).toMatch(/<video[^>]*playsinline/i)
    expect(html).toMatch(/<video[^>]*muted/i)
    expect(html).not.toContain('meet-avatar')
  })

  it('falls back to the initials, hidden from screen readers, without a camera', () => {
    const html = render(peer())
    expect(html).not.toContain('<video')
    expect(html).toContain('class="meet-avatar" aria-hidden="true">AL<')
  })

  it('plays a remote microphone through an audio element', () => {
    const html = render(peer({ audio: track() }))
    expect(html).toMatch(/<audio[^>]*autoplay/i)
  })

  it('has no audio element when there is nothing to play', () => {
    expect(render(peer())).not.toContain('<audio')
  })
})

describe('ParticipantTile label', () => {
  it('shows the name, and marks the local tile as you', () => {
    expect(render(peer())).toContain('Ada Lovelace<')
    expect(render(peer())).not.toContain('(you)')
    expect(render(peer({ local: true }))).toContain('Ada Lovelace (you)<')
  })

  it('flags the local tile for mirroring', () => {
    expect(render(peer({ local: true }))).toContain('data-local="true"')
    expect(render(peer())).toContain('data-local="false"')
  })

  it('announces a muted microphone to screen readers and shows the icon', () => {
    const muted = render(peer({ micOn: false }))
    expect(muted).toContain('microphone off')
    expect(muted).toContain('meet-slash')
    const open = render(peer({ micOn: true }))
    expect(open).not.toContain('microphone off')
    expect(open).not.toContain('meet-slash')
  })

  it('marks the active speaker without relying on colour alone', () => {
    const loud = render(peer({ speaking: true }))
    expect(loud).toContain('data-speaking="true"')
    expect(loud).toContain('>speaking<')
    const quiet = render(peer({ speaking: false }))
    expect(quiet).toContain('data-speaking="false"')
    expect(quiet).not.toContain('speaking<')
  })
})
