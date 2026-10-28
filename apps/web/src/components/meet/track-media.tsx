import { useEffect, useState } from 'react'
import type { MediaHandle } from '../../lib/meet'
import { attachMedia } from '../../lib/meet-session'

/**
 * Plays one LiveKit track. The element is created by React and handed to the
 * SDK, which owns what it shows and, with adaptive stream, how much it receives.
 * Video is always muted: sound comes from the separate audio elements.
 */
export function TrackMedia({
  handle,
  kind,
  className,
}: {
  handle: MediaHandle
  kind: 'video' | 'audio'
  className?: string
}) {
  const [element, setElement] = useState<HTMLMediaElement | null>(null)
  useEffect(() => attachMedia(handle, element), [handle, element])
  return kind === 'video' ? (
    <video ref={setElement} className={className} autoPlay playsInline muted />
  ) : (
    // biome-ignore lint/a11y/useMediaCaption: live call audio has no caption track
    <audio ref={setElement} autoPlay />
  )
}
