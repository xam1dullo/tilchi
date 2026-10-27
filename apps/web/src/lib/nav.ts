export const appRoles = ['learner', 'teacher', 'admin'] as const
export type AppRole = (typeof appRoles)[number]

export type NavItem = {
  to: '/app'
  id: 'groups'
  roles: readonly AppRole[]
}

export const appNav: readonly NavItem[] = [
  { to: '/app', id: 'groups', roles: ['learner', 'teacher', 'admin'] },
]

export function navForRole(role: AppRole) {
  return appNav.filter((item) => item.roles.includes(role))
}
