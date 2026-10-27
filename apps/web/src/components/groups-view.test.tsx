import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GroupRow } from '../lib/groups'
import { copy } from '../lib/i18n'
import { escapeHtml as esc } from '../testing/html'
import { EmptyGroups, GroupRows } from './groups-view'

const group: GroupRow = {
  id: '5c2f1f1e-9a53-4a42-8f0e-0d2d4a9a7b11',
  name: 'IELTS evening',
  capacity: 5,
  memberCount: 3,
  teacherName: 'Mukhtasar',
}

describe('EmptyGroups for a learner', () => {
  const html = renderToStaticMarkup(
    <EmptyGroups copy={copy.uz} staff={false} />,
  )

  it('follows the 7/5 layout with the locked Uzbek copy', () => {
    expect(html).toContain('class="empty-split"')
    expect(html).toContain('class="eyebrow">Guruhlar<')
    expect(html).toContain('<h2>Hali guruhingiz yo&#x27;q</h2>')
    expect(html).toContain('class="empty-panel"')
    expect(html).toContain(
      'O&#x27;qituvchi sizni guruhga qo&#x27;shgach, darslar shu yerda chiqadi.',
    )
  })

  it('offers the catalog as the primary action and Telegram as the secondary one', () => {
    expect(html).toMatch(/<a class="btn btn-primary" href="\/">[^<]*Kurslarni/)
    expect(html).toMatch(
      /<a class="btn btn-outline" href="https:\/\/t\.me\/tilchiuz_bot"[^>]*>Telegram&#x27;da yozish/,
    )
  })
})

describe('EmptyGroups for a teacher or admin', () => {
  const html = renderToStaticMarkup(<EmptyGroups copy={copy.en} staff />)

  it('says nothing is assigned and sends nobody to the catalog', () => {
    expect(html).toContain(esc(copy.en.emptyStaffTitle))
    expect(html).toContain(esc(copy.en.emptyStaffBody))
    expect(html).not.toContain(esc(copy.en.emptyTitle))
    expect(html).not.toContain(esc(copy.en.emptyBody))
    expect(html).not.toContain(esc(copy.en.catalog))
    expect(html).not.toContain(esc(copy.en.telegramWrite))
    expect(html).not.toContain('<a ')
  })
})

describe('GroupRows', () => {
  it('lists each group with its teacher and filled seats', () => {
    const html = renderToStaticMarkup(
      <GroupRows
        copy={copy.en}
        groups={[group, { ...group, id: 'b', name: 'Kids A1', memberCount: 0 }]}
      />,
    )
    expect(html).toContain('<h1 class="app-title">Groups</h1>')
    expect(html.match(/<li /g)).toHaveLength(2)
    expect(html).toContain('IELTS evening')
    expect(html).toContain('Kids A1')
    expect(html).toContain('Mukhtasar')
    expect(html).toContain('Seats <span class="num">3/5</span>')
    expect(html).toContain('Seats <span class="num">0/5</span>')
  })

  it('falls back to the teacher role when the teacher has no name', () => {
    const html = renderToStaticMarkup(
      <GroupRows copy={copy.ru} groups={[{ ...group, teacherName: null }]} />,
    )
    expect(html).toContain(`group-teacher">${copy.ru.roleTeacher}<`)
  })

  it('shows a group name as text, never as markup', () => {
    const html = renderToStaticMarkup(
      <GroupRows
        copy={copy.uz}
        groups={[{ ...group, name: '<img src=x onerror=alert(1)>' }]}
      />,
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
