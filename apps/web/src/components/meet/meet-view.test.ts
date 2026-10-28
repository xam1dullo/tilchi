import { type ReactNode, createElement, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { copy } from '../../lib/i18n'
import {
  type MediaHandle,
  type MeetEvent,
  type Peer,
  initialMeet,
  reduceMeet,
} from '../../lib/meet'
import { ControlBar } from './control-bar'
import { MeetView } from './meet-view'

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

const stateAfter = (...events: MeetEvent[]) =>
  events.reduce(reduceMeet, initialMeet)

const connected: MeetEvent = { type: 'status', status: { kind: 'connected' } }
const ended: MeetEvent = {
  type: 'status',
  status: { kind: 'ended', failure: 'notLive' },
}

const noop = () => undefined

const viewProps = (state = initialMeet) => ({
  state,
  copy: en,
  onToggle: noop,
  onStartAudio: noop,
  onRetry: noop,
  onLeave: noop,
})

const render = (state = initialMeet) =>
  renderToStaticMarkup(createElement(MeetView, viewProps(state)))

function elements(node: ReactNode): ReactNode[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<{ children?: ReactNode }>(node)) return []
  return [node, ...elements(node.props.children)]
}

describe('MeetView notices', () => {
  it('announces connecting politely while the controls stay in place', () => {
    const html = render()
    expect(html).toContain('role="status"')
    expect(html).toContain('Connecting to the meeting…')
    expect(html).toContain('>Meeting controls<')
  })

  it('says nothing for a healthy room', () => {
    const html = render(stateAfter(connected))
    expect(html).not.toContain('role="status"')
    expect(html).not.toContain('role="alert"')
  })

  it('raises a failure as an alert and offers a retry', () => {
    const html = render(stateAfter(ended))
    expect(html).toContain('role="alert"')
    expect(html).toContain('The lesson is not live. It may have ended.')
    expect(html).toContain('>Try again<')
  })

  it('offers no retry while the room is still working', () => {
    expect(render(stateAfter(connected))).not.toContain('Try again')
    expect(render()).not.toContain('Try again')
  })

  it('explains why video is off on a weak network', () => {
    const html = render(
      stateAfter(connected, { type: 'quality', quality: 'poor' }),
    )
    expect(html).toContain('Your connection is weak, so video is off.')
  })

  it('alerts when the browser blocked a device', () => {
    const html = render(
      stateAfter(connected, { type: 'device-failed', device: 'camera' }),
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Camera access is blocked.')
  })

  it('offers to turn the sound on only when the browser blocked it', () => {
    expect(render(stateAfter(connected))).not.toContain('Turn on sound')
    const blocked = render(
      stateAfter(connected, { type: 'sound', playing: false }),
    )
    expect(blocked).toContain('>Turn on sound<')
  })
})

describe('MeetView tiles', () => {
  const peers = [
    peer({ id: 'me', name: 'Mukhtasar', local: true, video: track() }),
    peer({ id: 'b', name: 'Bobur', video: track(), audio: track() }),
    peer({ id: 'c', name: 'Charos' }),
  ]

  it('lists a labelled tile per peer, in the given order', () => {
    const html = render(stateAfter(connected, { type: 'peers', peers }))
    expect(html).toContain('<ul class="meet-grid" aria-label="Participants">')
    expect(html.match(/class="meet-tile"/g)).toHaveLength(3)
    const order = ['Mukhtasar (you)', 'Bobur', 'Charos'].map((name) =>
      html.indexOf(name),
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(order.every((index) => index > 0)).toBe(true)
  })

  it('renders video while it is allowed and drops it in audio-only', () => {
    const live = stateAfter(connected, { type: 'peers', peers })
    expect(render(live).match(/<video/g)).toHaveLength(2)
    const audioOnly = reduceMeet(live, { type: 'toggle', control: 'audioOnly' })
    const html = render(audioOnly)
    expect(html).not.toContain('<video')
    expect(html.match(/<audio/g)).toHaveLength(1)
    expect(html.match(/meet-avatar/g)).toHaveLength(3)
  })

  it('shows no tiles once the meeting has ended', () => {
    const html = render(stateAfter(connected, { type: 'peers', peers }, ended))
    expect(html).not.toContain('meet-tile')
    expect(html).not.toContain('<video')
  })
})

describe('MeetView actions', () => {
  it('wires the sound and retry buttons, and hands the rest to the control bar', () => {
    const seen: string[] = []
    const state = stateAfter({ type: 'sound', playing: false }, ended)
    const tree = MeetView({
      ...viewProps(state),
      onToggle: (control) => seen.push(`toggle ${control}`),
      onStartAudio: () => seen.push('startAudio'),
      onRetry: () => seen.push('retry'),
      onLeave: () => seen.push('leave'),
    })
    const all = elements(tree)
    const buttons = all.filter(
      (node) => isValidElement(node) && node.type === 'button',
    )
    for (const button of buttons) {
      if (isValidElement<{ onClick: () => void }>(button)) {
        button.props.onClick()
      }
    }
    expect(seen).toEqual(['startAudio', 'retry'])

    const bar = all.find(
      (node) => isValidElement(node) && node.type === ControlBar,
    )
    if (
      !isValidElement<{ onToggle: (c: 'mic') => void; onLeave: () => void }>(
        bar,
      )
    ) {
      throw new Error('control bar missing')
    }
    bar.props.onToggle('mic')
    bar.props.onLeave()
    expect(seen.slice(2)).toEqual(['toggle mic', 'leave'])
  })
})
