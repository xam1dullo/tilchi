import { useEffect, useReducer, useState } from 'react'
import type { LessonStatus } from '../../lib/classroom'
import type { Copy } from '../../lib/i18n'
import { initialMeet, mediaPlan, nextAttempt, reduceMeet } from '../../lib/meet'
import { fetchMeetToken, signalUrl } from '../../lib/meet-api'
import { openLiveKitRoom } from '../../lib/meet-livekit'
import { createSession } from '../../lib/meet-session'
import type { AppRole } from '../../lib/nav'
import { type MeetCopy, MeetView } from './meet-view'

type RoomProps = {
  lessonId: string
  previewRole: AppRole | null
  copy: MeetCopy
  onLeave: () => void
}

// The browser side effects live here and nowhere else: start the session when
// the component mounts, leave when it unmounts, and keep the room's devices in
// line with the plan. Every decision is in lib/meet*.ts, where it is tested.
function MeetSession({
  lessonId,
  previewRole,
  copy,
  onLeave,
  onRetry,
}: RoomProps & { onRetry: () => void }) {
  const [state, dispatch] = useReducer(reduceMeet, initialMeet)
  const [session] = useState(() =>
    createSession({
      fetchToken: () => fetchMeetToken(lessonId, previewRole),
      openRoom: openLiveKitRoom,
      signalUrl: () => signalUrl(window.location),
      emit: dispatch,
    }),
  )
  const { mic, camera } = mediaPlan(state)
  useEffect(() => session.start(), [session])
  useEffect(() => {
    session.plan({ mic, camera })
  }, [session, mic, camera])
  return (
    <MeetView
      state={state}
      copy={copy}
      onToggle={(control) => dispatch({ type: 'toggle', control })}
      onStartAudio={session.startAudio}
      onRetry={onRetry}
      onLeave={onLeave}
    />
  )
}

/** Joins the lesson's room. A retry remounts the session for a clean slate. */
export function MeetRoom(props: RoomProps) {
  const [attempt, retry] = useReducer(nextAttempt, 0)
  return <MeetSession key={attempt} {...props} onRetry={retry} />
}

/** The room once the lesson is live, the waiting message before and after. */
export function MeetEntry({
  status,
  ...room
}: RoomProps & {
  status: LessonStatus
  copy: MeetCopy & Pick<Copy, 'meetWaiting'>
}) {
  return status === 'live' ? (
    <MeetRoom {...room} />
  ) : (
    <p className="notice" data-tone="status" role="status">
      {room.copy.meetWaiting}
    </p>
  )
}
