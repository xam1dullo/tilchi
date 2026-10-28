import type { Copy } from '../../lib/i18n'
import {
  type Control,
  type MeetState,
  type NoticeKey,
  controlsOf,
  meetNotices,
  tilesOf,
} from '../../lib/meet'
import { ControlBar, type ControlsCopy } from './control-bar'
import { ParticipantTile, type TileCopy } from './participant-tile'

export type MeetCopy = TileCopy &
  ControlsCopy &
  Pick<Copy, NoticeKey | 'meetParticipants' | 'meetEnableSound' | 'retry'>

/** The whole meeting UI as a function of state. It holds no state and no effects. */
export function MeetView({
  state,
  copy,
  onToggle,
  onStartAudio,
  onRetry,
  onLeave,
}: {
  state: MeetState
  copy: MeetCopy
  onToggle: (control: Control) => void
  onStartAudio: () => void
  onRetry: () => void
  onLeave: () => void
}) {
  return (
    <div className="meet-stage">
      <div className="meet-notices">
        {meetNotices(state).map((notice) => (
          <p
            key={notice.key}
            className="meet-notice"
            data-tone={notice.tone}
            role={notice.tone}
          >
            {copy[notice.key]}
          </p>
        ))}
        {state.soundBlocked ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartAudio}
          >
            {copy.meetEnableSound}
          </button>
        ) : null}
        {state.status.kind === 'ended' ? (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {copy.retry}
          </button>
        ) : null}
      </div>
      <ul className="meet-grid" aria-label={copy.meetParticipants}>
        {tilesOf(state).map((tile) => (
          <ParticipantTile key={tile.id} tile={tile} copy={copy} />
        ))}
      </ul>
      <ControlBar
        view={controlsOf(state)}
        copy={copy}
        onToggle={onToggle}
        onLeave={onLeave}
      />
    </div>
  )
}
