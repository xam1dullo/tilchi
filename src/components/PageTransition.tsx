import { ViewTransition } from 'react'

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{
        'nav-forward': 'nav-forward',
        'nav-back': 'nav-back',
        'nav-lateral': 'fade-in',
        default: 'none',
      }}
      exit={{
        'nav-forward': 'nav-forward',
        'nav-back': 'nav-back',
        'nav-lateral': 'fade-out',
        default: 'none',
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}
