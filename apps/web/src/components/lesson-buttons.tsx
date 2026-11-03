import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { LessonRecord } from '../lib/classroom'
import { createEndConfirm, lessonAction } from '../lib/lesson-actions'
import type { keepAppSearch } from '../lib/preview'
import { LessonActions, type LessonActionsCopy } from './lesson-actions'

/** Start / End / Join for one lesson, with the request state and the End
 *  double-tap guard. Shared by the group page and the home lead. */
export function LessonButtons({
  primary = false,
  lesson,
  previewRole,
  search,
  copy,
  focusId = 'group-lessons-title',
}: {
  primary?: boolean
  lesson: LessonRecord
  /** Where focus lands after a refresh removes the pressed button. */
  focusId?: string
  previewRole: 'learner' | 'teacher' | 'admin' | null
  search: ReturnType<typeof keepAppSearch>
  copy: LessonActionsCopy
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const run = (path: string) => {
    setBusy(true)
    setFailed(false)
    void lessonAction(
      () => apiFetch(path, { method: 'POST', previewRole }),
      () => router.invalidate(),
    ).then((ok) => {
      setBusy(false)
      setFailed(!ok)
      // The pressed button is gone after a refresh; keep focus in the rail.
      if (ok) document.getElementById(focusId)?.focus()
    })
  }
  const endRef = useRef(() => {})
  endRef.current = () => run(`/api/lessons/${lesson.id}/end`)
  const [endConfirm] = useState(() =>
    createEndConfirm(setConfirming, () => endRef.current()),
  )
  useEffect(() => () => endConfirm.cancel(), [endConfirm])
  if (!lesson.can.start && !lesson.can.end && !lesson.can.join) return null
  return (
    <LessonActions
      lesson={lesson}
      primary={primary}
      busy={busy}
      confirming={confirming}
      failed={failed}
      search={search}
      copy={copy}
      onStart={() => run(`/api/lessons/${lesson.id}/start`)}
      onEnd={endConfirm.press}
      onCancelEnd={endConfirm.cancel}
    />
  )
}
