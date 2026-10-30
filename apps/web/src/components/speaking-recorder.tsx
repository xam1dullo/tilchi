import { useEffect, useRef, useState } from 'react'
import {
  type AudioType,
  MAX_RECORDING_MS,
  micSupported,
  openOutside,
  pickMime,
  recorderSlots,
} from '../lib/attempt'
import type { Copy } from '../lib/i18n'

type Phase =
  | 'checking'
  | 'unsupported'
  | 'denied'
  | 'ready'
  | 'starting'
  | 'recording'
type Take = { blob: Blob; type: AudioType; url: string }
type Live = { recorder: MediaRecorder; stream: MediaStream; timer: number }

function release({ recorder, stream, timer }: Live) {
  clearTimeout(timer)
  if (recorder.state !== 'inactive') recorder.stop()
  for (const track of stream.getTracks()) track.stop()
}

/** Loaded lazily: MediaRecorder code stays out of the main bundle. */
export default function SpeakingRecorder({
  copy,
  recorded,
  onUpload,
  onActive,
}: {
  copy: Copy
  /** The server already holds a recording for this question. */
  recorded: boolean
  /** Null on success, else the copy key of the failure. */
  onUpload: (blob: Blob, type: AudioType) => Promise<keyof Copy | null>
  /** True while starting, recording or uploading: the page holds Submit. */
  onActive: (active: boolean) => void
}) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [take, setTake] = useState<Take | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<keyof Copy | null>(null)
  const live = useRef<Live | null>(null)
  const slots = useRef(recorderSlots())
  const active = phase === 'starting' || phase === 'recording' || uploading

  // The latest callback, so a new one each render does not re-run the effect.
  const report = useRef(onActive)
  report.current = onActive
  useEffect(() => {
    report.current(active)
    return () => report.current(false)
  }, [active])

  useEffect(() => {
    setPhase(
      micSupported(navigator, globalThis.MediaRecorder)
        ? 'ready'
        : 'unsupported',
    )
    const current = slots.current
    return () => {
      current.cancel()
      if (live.current) release(live.current)
      live.current = null
    }
  }, [])

  useEffect(
    () => () => {
      if (take) URL.revokeObjectURL(take.url)
    },
    [take],
  )

  async function send(blob: Blob, type: AudioType) {
    setUploading(true)
    setError(null)
    setError(await onUpload(blob, type))
    setUploading(false)
  }

  async function start() {
    const id = slots.current.begin()
    if (id === null) return
    setPhase('starting')
    setError(null)
    const type = pickMime((t) => MediaRecorder.isTypeSupported(t))
    let stream: MediaStream | null = null
    let recorder: MediaRecorder | null = null
    try {
      if (type) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        recorder = new MediaRecorder(stream, { mimeType: type })
      }
    } catch {
      // A stream without a recorder: the browser cannot write this type.
    }
    if (!slots.current.isCurrent(id)) {
      for (const track of stream?.getTracks() ?? []) track.stop()
      return
    }
    if (!type || !stream || !recorder) {
      for (const track of stream?.getTracks() ?? []) track.stop()
      slots.current.end(id)
      return setPhase(stream || !type ? 'unsupported' : 'denied')
    }
    const chunks: Blob[] = []
    const own: Live = {
      recorder,
      stream,
      timer: window.setTimeout(() => recorder.stop(), MAX_RECORDING_MS),
    }
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      release(own)
      if (live.current?.recorder === recorder) live.current = null
      if (!slots.current.isCurrent(id)) return
      slots.current.end(id)
      const blob = new Blob(chunks, { type })
      setTake({ blob, type, url: URL.createObjectURL(blob) })
      setPhase('ready')
      void send(blob, type)
    }
    recorder.start()
    live.current = own
    setPhase('recording')
  }

  if (phase === 'checking') return <p className="hint">{copy.recordLoading}</p>
  if (phase === 'unsupported' || phase === 'denied') {
    const url = window.location.href
    return (
      <div>
        <p className="notice" data-tone="warn" role="alert">
          {phase === 'denied' ? copy.recordDenied : copy.recordNoMic}
        </p>
        <div className="lesson-actions">
          {phase === 'denied' ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => void start()}
            >
              {copy.retry}
            </button>
          ) : null}
          {/* ponytail: the browser opens signed out; the learner signs in there again. */}
          <a
            className="btn btn-outline"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              if (openOutside(window, url)) event.preventDefault()
            }}
          >
            {copy.recordOpenBrowser}
          </a>
        </div>
      </div>
    )
  }
  if (phase === 'starting' || phase === 'recording') {
    return (
      <div className="lesson-actions">
        <span role="status">
          {phase === 'starting' ? copy.recordLoading : copy.recordRecording}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (live.current) return live.current.recorder.stop()
            // Still waiting on the microphone: give up; a late stream is stopped.
            slots.current.cancel()
            setPhase('ready')
          }}
        >
          {copy.recordStop}
        </button>
      </div>
    )
  }
  return (
    <div>
      {take ? (
        // biome-ignore lint/a11y/useMediaCaption: the learner's own voice, no captions exist
        <audio controls src={take.url} />
      ) : null}
      {uploading ? (
        <p className="notice" role="status">
          {copy.recordUploading}
        </p>
      ) : error ? (
        <p className="notice" data-tone="error" role="alert">
          {copy[error]}
        </p>
      ) : recorded ? (
        <p className="notice" data-tone="done" role="status">
          {copy.recordSaved}
        </p>
      ) : null}
      {uploading ? null : (
        <div className="lesson-actions">
          {take && error ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => void send(take.blob, take.type)}
            >
              {copy.recordRetry}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void start()}
          >
            {take || recorded ? copy.recordAgain : copy.recordStart}
          </button>
        </div>
      )}
    </div>
  )
}
