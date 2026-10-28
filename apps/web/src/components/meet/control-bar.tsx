import type { Copy } from '../../lib/i18n'
import type { Control, ControlsView } from '../../lib/meet'
import { Icon, type IconName } from './icon'

export type ControlsCopy = Pick<
  Copy,
  'meetControls' | 'meetMic' | 'meetCamera' | 'meetAudioOnly' | 'leaveMeet'
>

type ButtonProps = {
  icon: IconName
  label: string
  slash?: boolean
  /** Present for toggles: reports aria-pressed and can be locked. */
  state?: { on: boolean; disabled: boolean }
  danger?: boolean
  onClick: () => void
}

// The visible text is the accessible name, so sighted and screen reader users
// get the same word. The label is hidden visually on narrow screens only.
function ControlButton({
  icon,
  label,
  slash,
  state,
  danger,
  onClick,
}: ButtonProps) {
  return (
    <button
      type="button"
      className={danger ? 'meet-control meet-leave' : 'meet-control'}
      aria-pressed={state?.on}
      disabled={state?.disabled}
      onClick={onClick}
    >
      <Icon name={icon} slash={slash} />
      <span className="meet-control-label">{label}</span>
    </button>
  )
}

export function ControlBar({
  view,
  copy,
  onToggle,
  onLeave,
}: {
  view: ControlsView
  copy: ControlsCopy
  onToggle: (control: Control) => void
  onLeave: () => void
}) {
  return (
    <fieldset className="meet-controls">
      <legend className="sr-only">{copy.meetControls}</legend>
      <div className="meet-controls-row">
        <ControlButton
          icon="mic"
          label={copy.meetMic}
          slash={!view.mic.on}
          state={view.mic}
          onClick={() => onToggle('mic')}
        />
        <ControlButton
          icon="camera"
          label={copy.meetCamera}
          slash={!view.camera.on}
          state={view.camera}
          onClick={() => onToggle('camera')}
        />
        <ControlButton
          icon="headphones"
          label={copy.meetAudioOnly}
          state={view.audioOnly}
          onClick={() => onToggle('audioOnly')}
        />
        <ControlButton
          icon="leave"
          label={copy.leaveMeet}
          danger
          onClick={onLeave}
        />
      </div>
    </fieldset>
  )
}
