import { botLink, tgLinkProps } from '@tilchi/content'
import type { GroupRow } from '../lib/groups'
import type { Copy } from '../lib/i18n'

// Learners are told how a group starts and where to find courses. Teachers and
// admins already know, so they only see that nothing is assigned.
export function EmptyGroups({ copy, staff }: { copy: Copy; staff: boolean }) {
  return (
    <section className="empty-split">
      <div>
        <p className="eyebrow">{copy.groups}</p>
        <h2>{staff ? copy.emptyStaffTitle : copy.emptyTitle}</h2>
      </div>
      <div className="empty-panel">
        <p>{staff ? copy.emptyStaffBody : copy.emptyBody}</p>
        {staff ? null : (
          <div className="panel-actions">
            <a className="btn btn-primary" href="/">
              {copy.catalog}
            </a>
            <a className="btn btn-outline" {...tgLinkProps(botLink('', ''))}>
              {copy.telegramWrite}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

export function GroupRows({
  copy,
  groups,
}: {
  copy: Copy
  groups: readonly GroupRow[]
}) {
  return (
    <section>
      <h1 className="app-title">{copy.groups}</h1>
      <ul className="rows">
        {groups.map((group) => (
          <li className="row group-row" key={group.id}>
            <span className="group-name">{group.name}</span>
            <span className="group-teacher">
              {group.teacherName ?? copy.roleTeacher}
            </span>
            <span className="group-seats">
              {copy.seats}{' '}
              <span className="num">
                {`${group.memberCount}/${group.capacity}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
