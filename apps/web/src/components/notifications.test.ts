import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { copy } from '../lib/i18n'
import { NotificationList, notificationLink, type Inbox } from './notifications'

const id = '0199aaa0-0000-7000-8000-000000000010'
const inbox: Inbox = {
  unread: 52,
  notifications: [
    {
      id,
      title: 'Yangi dars',
      body: 'Dars boshlandi.',
      link: `/app/groups/${id}`,
      readAt: null,
      createdAt: '2026-10-29T10:00:00.000Z',
    },
  ],
}

describe('notifications', () => {
  it('marks the selected unread notification and blocks duplicate submissions', () => {
    const onRead = vi.fn()
    const props = {
      inbox,
      copy: copy.uz,
      locale: 'uz' as const,
      previewRole: null,
      busyId: null,
      error: false,
      onRead,
    }
    function buttons(
      node: ReactNode,
    ): Array<{ onClick?: () => void; disabled?: boolean }> {
      if (Array.isArray(node)) return node.flatMap(buttons)
      if (
        !isValidElement<{
          children?: ReactNode
          onClick?: () => void
          disabled?: boolean
        }>(node)
      )
        return []
      if (node.type === 'button') return [node.props]
      return buttons(node.props.children)
    }
    const [button] = buttons(NotificationList(props))
    expect(button?.disabled).toBe(false)
    button?.onClick?.()
    expect(onRead).toHaveBeenCalledExactlyOnceWith(id)
    const [pending] = buttons(NotificationList({ ...props, busyId: id }))
    expect(pending?.disabled).toBe(true)
    expect(
      renderToStaticMarkup(
        createElement(NotificationList, { ...props, busyId: id }),
      ),
    ).toContain(copy.uz.notificationsSaving)
  })

  it('shows the server unread total and offers an accessible mark-read action', () => {
    const DateTimeFormat = Intl.DateTimeFormat
    const formatter = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(function passthrough(locale, options) {
        return new DateTimeFormat(locale, options)
      })
    try {
      const html = renderToStaticMarkup(
        createElement(NotificationList, {
          inbox,
          copy: copy.uz,
          locale: 'uz',
          previewRole: 'teacher',
          busyId: null,
          error: false,
          onRead: () => {},
        }),
      )
      expect(formatter).toHaveBeenCalled()
      expect(formatter.mock.calls.map(([locale]) => locale)).not.toEqual(
        expect.arrayContaining(['uz']),
      )
      expect(formatter.mock.calls.map(([locale]) => locale)).not.toEqual(
        expect.arrayContaining(['uz-UZ']),
      )
      expect(html).toContain('52')
      expect(html).toContain('Yangi dars')
      expect(html).toContain('29-okt, 2026, 15:00')
      expect(html).toContain(`/app/groups/${id}?preview=teacher`)
      expect(html).toContain('/app/notifications?preview=teacher')
      expect(html).toContain('aria-label="O‘qilgan deb belgilash: Yangi dars"')
    } finally {
      formatter.mockRestore()
    }
  })

  it('keeps invalid notification timestamps empty', () => {
    const html = renderToStaticMarkup(
      createElement(NotificationList, {
        inbox: {
          ...inbox,
          notifications: [{ ...inbox.notifications[0], createdAt: 'invalid' }],
        },
        copy: copy.uz,
        locale: 'uz',
        previewRole: null,
        busyId: null,
        error: false,
        onRead: () => {},
      }),
    )
    expect(html).not.toContain('invalid')
    expect(html).not.toContain('<time')
  })

  it('shows an empty state and reports failed actions without losing the item', () => {
    const empty = renderToStaticMarkup(
      createElement(NotificationList, {
        inbox: { unread: 0, notifications: [] },
        copy: copy.uz,
        locale: 'uz',
        previewRole: null,
        busyId: null,
        error: false,
        onRead: () => {},
      }),
    )
    expect(empty).toContain(copy.uz.notificationsEmpty)
    const failed = renderToStaticMarkup(
      createElement(NotificationList, {
        inbox,
        copy: copy.uz,
        locale: 'uz',
        previewRole: null,
        busyId: null,
        error: true,
        onRead: () => {},
      }),
    )
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('Yangi dars')
  })

  it('only follows known local app links and preserves the preview role', () => {
    expect(notificationLink(`/app/meet/${id}`, 'learner')).toBe(
      `/app/meet/${id}?preview=learner`,
    )
    expect(notificationLink(`/app/groups/${id}`, null)).toBe(
      `/app/groups/${id}`,
    )
    expect(notificationLink(`/app/attempts/${id}`, null)).toBe(
      `/app/attempts/${id}`,
    )
    expect(notificationLink('/app/assignments', 'learner')).toBe(
      '/app/assignments?preview=learner',
    )
    for (const link of [
      '/app/tests',
      '/app/assignments/x',
      'https://example.com',
      '//example.com/a',
      '/app/groups/../admin',
      'javascript:alert(1)',
    ]) {
      expect(notificationLink(link, 'teacher')).toBeNull()
    }
  })
})
