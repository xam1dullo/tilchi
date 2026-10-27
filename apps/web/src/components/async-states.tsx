import {
  type ErrorComponentProps,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { isForbidden } from '../lib/http-failure'
import { type Copy, messages } from '../lib/i18n'

export function SkeletonRows() {
  return (
    <div className="rows" aria-hidden="true">
      <div className="row skeleton" />
      <div className="row skeleton" />
      <div className="row skeleton" />
    </div>
  )
}

export function ForbiddenView({ copy }: { copy: Copy }) {
  return (
    <section className="forbidden">
      <h1>{copy.forbiddenTitle}</h1>
      <p>{copy.forbiddenBody}</p>
    </section>
  )
}

export function LoadErrorView({
  copy,
  error,
  retry,
}: {
  copy: Copy
  error: unknown
  retry: () => void
}) {
  if (isForbidden(error)) return <ForbiddenView copy={copy} />
  return (
    <div className="row error-row" role="alert">
      <p>{copy.error}</p>
      <button className="btn btn-outline" type="button" onClick={retry}>
        {copy.retry}
      </button>
    </div>
  )
}

// The boundary's own reset only clears the error on screen and the router hands
// back the same failed match, so a retry has to ask the router to load again.
export function LoadError({ error }: ErrorComponentProps) {
  const { locale } = useRouteContext({ from: '__root__' })
  const router = useRouter()
  return (
    <LoadErrorView
      copy={messages(locale)}
      error={error}
      retry={() => {
        void router.invalidate()
      }}
    />
  )
}
