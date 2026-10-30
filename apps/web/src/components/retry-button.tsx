import { useRouter } from '@tanstack/react-router'

/**
 * Retry for a route error: the boundary's own `reset` only re-renders and
 * keeps the failed loader data, so this reloads the loaders instead.
 */
export function RetryButton({ label }: { label: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      className="btn btn-outline"
      onClick={() => void router.invalidate()}
    >
      {label}
    </button>
  )
}
