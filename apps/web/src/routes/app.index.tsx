import { createFileRoute } from '@tanstack/react-router'

// Empty state: learner without a Group sees catalog CTA (phase 2).
export const Route = createFileRoute('/app/')({
  component: () => (
    <main>
      <h1>Tilchi — /app</h1>
      <p>No groups yet.</p>
    </main>
  ),
})
