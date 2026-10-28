import { type ReactNode, createElement, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { copy } from '../../lib/i18n'
import {
  type Control,
  type MeetEvent,
  controlsOf,
  initialMeet,
  reduceMeet,
} from '../../lib/meet'
import { ControlBar } from './control-bar'

const en = copy.en

const viewAfter = (...events: MeetEvent[]) =>
  controlsOf(events.reduce(reduceMeet, initialMeet))

const props = (view = controlsOf(initialMeet)) => ({
  view,
  copy: en,
  onToggle: () => undefined,
  onLeave: () => undefined,
})

const buttonsOf = (html: string) =>
  [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(
    ([, attrs = '', inner = '']) => ({
      attrs,
      label: inner.replace(/<[^>]*>/g, ''),
      slashed: inner.includes('meet-slash'),
    }),
  )

const render = (view = controlsOf(initialMeet)) =>
  renderToStaticMarkup(createElement(ControlBar, props(view)))

/** Every onClick in the element tree, in order, without needing a DOM. */
function clicks(node: ReactNode): (() => void)[] {
  if (Array.isArray(node)) return node.flatMap(clicks)
  if (!isValidElement<{ onClick?: () => void; children?: ReactNode }>(node)) {
    return []
  }
  const own = node.props.onClick ? [node.props.onClick] : []
  return [...own, ...clicks(node.props.children)]
}

describe('ControlBar structure', () => {
  it('is a labelled group of four plain buttons in a fixed order', () => {
    const html = render()
    expect(html).toContain(
      '<fieldset class="meet-controls"><legend class="sr-only">Meeting controls</legend>',
    )
    const buttons = buttonsOf(html)
    expect(buttons.map((button) => button.label)).toEqual([
      'Microphone',
      'Camera',
      'Audio only',
      'Leave',
    ])
    for (const button of buttons)
      expect(button.attrs).toContain('type="button"')
  })

  it('keeps icons out of the accessible name', () => {
    expect(render()).toContain('aria-hidden="true"')
    expect(render()).toContain('focusable="false"')
  })
})

describe('ControlBar state', () => {
  it('reports the toggles with aria-pressed, and none on Leave', () => {
    const [mic, camera, audioOnly, leave] = buttonsOf(render())
    expect(mic?.attrs).toContain('aria-pressed="true"')
    expect(camera?.attrs).toContain('aria-pressed="true"')
    expect(audioOnly?.attrs).toContain('aria-pressed="false"')
    expect(leave?.attrs).not.toContain('aria-pressed')
  })

  it('slashes the mic and the camera icons when they are off, never the others', () => {
    const on = buttonsOf(render())
    expect(on.map((button) => button.slashed)).toEqual([
      false,
      false,
      false,
      false,
    ])
    const off = buttonsOf(
      render(
        viewAfter(
          { type: 'toggle', control: 'mic' },
          { type: 'toggle', control: 'camera' },
        ),
      ),
    )
    expect(off.map((button) => button.slashed)).toEqual([
      true,
      true,
      false,
      false,
    ])
  })

  it('locks the camera in audio-only and shows audio-only as pressed', () => {
    const [mic, camera, audioOnly] = buttonsOf(
      render(viewAfter({ type: 'toggle', control: 'audioOnly' })),
    )
    expect(mic?.attrs).not.toContain('disabled')
    expect(camera?.attrs).toContain('disabled')
    expect(camera?.attrs).toContain('aria-pressed="false"')
    expect(audioOnly?.attrs).toContain('aria-pressed="true"')
    expect(audioOnly?.attrs).not.toContain('disabled')
  })

  it('locks every toggle but not Leave once the meeting has ended', () => {
    const buttons = buttonsOf(
      render(
        viewAfter({
          type: 'status',
          status: { kind: 'ended', failure: 'dropped' },
        }),
      ),
    )
    expect(buttons.map((button) => button.attrs.includes('disabled'))).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it('styles Leave as the destructive action', () => {
    const [mic, , , leave] = buttonsOf(render())
    expect(leave?.attrs).toContain('meet-leave')
    expect(mic?.attrs).not.toContain('meet-leave')
  })
})

describe('ControlBar actions', () => {
  it('sends each toggle its own control and Leave its own handler', () => {
    const seen: string[] = []
    const tree = ControlBar({
      ...props(),
      onToggle: (control: Control) => seen.push(control),
      onLeave: () => seen.push('leave'),
    })
    const handlers = clicks(tree)
    expect(handlers).toHaveLength(4)
    for (const handler of handlers) handler()
    expect(seen).toEqual(['mic', 'camera', 'audioOnly', 'leave'])
  })
})
