import { useEffect, useRef, useState } from 'react'
import {
  type AudioType,
  MAX_RECORDING_MS,
  micSupported,
  openOutside,
  pickMime,
} from '../lib/attempt'
import type { Copy } from '../lib/i18n'

type Phase = 'checking' | 'unsupported' | 'denied' | 'ready' | 'recording'
type Take = { blob: Blob; type: AudioType; url: string }
type Live = { recorder: MediaRecorder; stream: MediaStream; timer: number }

function release(current: Live) {
  clearTimeout(current.timer)
  if (current.recorder.state !== 'inactive') current.recorder.stop()
  for (const track of current.stream.getTracks()) track.stop()
}

/** Loaded lazily: MediaRecorder code stays out of the main bundle. */
export default function SpeakingRecorder({
  copy,
  recorded,
  onUpload,
}: {
  copy: Copy
  /** The server already holds a recording for this question. */
  recorded: boolean
  /** Null on success, else the copy key of the failure. */
  onUpload: (blob: Blob, type: AudioType) => Promise<keyof Copy | null>
}) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [take, setTake] = useState<Take | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<keyof Copy | null>(null)
  const live = useRef<Live | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    setPhase(
      micSupported(navigator, globalThis.MediaRecorder)
        ? 'ready'
        : 'unsupported',
    )
    return () => {
      mounted.current = false
      const current = live.current
      if (!current) return
      live.current = null
      current.recorder.onstop = null
      release(current)
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
    const type = pickMime((t) => MediaRecorder.isTypeSupported(t))
    if (!type) return setPhase('unsupported')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return setPhase('denied')
    }
    if (!mounted.current) {
      for (const track of stream.getTracks()) track.stop()
      return
    }
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType: type })
    } catch {
      for (const track of stream.getTracks()) track.stop()
      return setPhase('unsupported')
    }
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      if (live.current) release(live.current)
      live.current = null
      const blob = new Blob(chunks, { type })
      setTake({ blob, type, url: URL.createObjectURL(blob) })
      setPhase('ready')
      void send(blob, type)
    }
    recorder.start()
    live.current = {
      recorder,
      stream,
      timer: window.setTimeout(() => recorder.stop(), MAX_RECORDING_MS),
    }
    setError(null)
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
    )
  }
  if (phase === 'recording') {
    return (
      <div className="lesson-actions">
        <span role="status">{copy.recordRecording}</span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => live.current?.recorder.stop()}
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
