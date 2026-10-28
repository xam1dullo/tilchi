import type { Copy } from '../../lib/i18n'
import { type Peer, initialsOf } from '../../lib/meet'
import { Icon } from './icon'
import { TrackMedia } from './track-media'

export type TileCopy = Pick<Copy, 'meetYou' | 'meetMicOff' | 'meetSpeaking'>

/** Ink-dark tile: video or initials, a name label, and an active-speaker ring. */
export function ParticipantTile({
  tile,
  copy,
}: {
  tile: Peer
  copy: TileCopy
}) {
  return (
    <li
      className="meet-tile"
      data-speaking={tile.speaking}
      data-local={tile.local}
    >
      {tile.video ? (
        <TrackMedia kind="video" handle={tile.video} className="meet-video" />
      ) : (
        <span className="meet-avatar" aria-hidden="true">
          {initialsOf(tile.name)}
        </span>
      )}
      {tile.audio ? <TrackMedia kind="audio" handle={tile.audio} /> : null}
      <span className="meet-label">
        <span className="meet-name">
          {tile.local ? `${tile.name} (${copy.meetYou})` : tile.name}
        </span>
        {tile.micOn ? null : (
          <span className="meet-flag">
            <Icon name="mic" slash />
            <span className="sr-only">{copy.meetMicOff}</span>
          </span>
        )}
        {tile.speaking ? (
          <span className="sr-only">{copy.meetSpeaking}</span>
        ) : null}
      </span>
    </li>
  )
}
