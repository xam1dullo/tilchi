export const appRoles = ['learner', 'teacher', 'admin'] as const
export type AppRole = (typeof appRoles)[number]

export type NavItem = {
  to:
    | '/app'
    | '/app/notifications'
    | '/app/courses'
    | '/app/tests'
    | '/app/assignments'
  id: 'groups' | 'notifications' | 'catalogTitle' | 'tests' | 'myTests'
  roles: readonly AppRole[]
}

export const appNav: readonly NavItem[] = [
  { to: '/app', id: 'groups', roles: ['learner', 'teacher', 'admin'] },
  { to: '/app/courses', id: 'catalogTitle', roles: ['admin'] },
  { to: '/app/tests', id: 'tests', roles: ['teacher', 'admin'] },
  { to: '/app/assignments', id: 'myTests', roles: ['learner'] },
  {
    to: '/app/notifications',
    id: 'notifications',
    roles: ['learner', 'teacher', 'admin'],
  },
]

export function navForRole(role: AppRole) {
  return appNav.filter((item) => item.roles.includes(role))
}
