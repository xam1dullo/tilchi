import { Logger } from '@nestjs/common'
import type { OnApplicationBootstrap } from '@nestjs/common'
import { type StorageConfig, storageConfig } from '../config'
import { presignUrl } from './sigv4'

/** A browser upload URL stays valid this long (PRD J5 AC2). */
export const UPLOAD_TTL_SECONDS = 180
/** Playback links are for a teacher listening, so they live a little longer. */
export const PLAYBACK_TTL_SECONDS = 600

export const AUDIO_TYPES = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
} as const
export type AudioType = keyof typeof AUDIO_TYPES
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024

/**
 * Keys carry only ids: no names, phone numbers or other personal data. Every
 * upload url gets its own nonce, so an old url never writes the current key.
 */
export const audioKey = (
  attemptId: string,
  questionId: string,
  type: AudioType,
  nonce: string,
) => `audio/${attemptId}/${questionId}/${nonce}.${AUDIO_TYPES[type]}`

/**
 * Where a recording is frozen at submit. No upload url is ever signed under
 * this prefix, so a url still valid after submit cannot change what is graded.
 * Each submit call writes under its own id: a call that loses the race can
 * never copy over the copy the winner published.
 */
export const submittedKey = (key: string, submitId: string) =>
  key.replace(/^audio\//, `submitted/${submitId}/`)

export type Upload = {
  url: string
  method: 'PUT'
  /** The browser must send exactly these; they are part of the signature. */
  headers: Record<string, string>
  expiresIn: number
}

/**
 * S3-compatible object storage (MinIO on the VPS, ADR 0011). Browsers talk to
 * `publicUrl` with presigned URLs; the API itself uses `endpoint`.
 */
export class ObjectStorage implements OnApplicationBootstrap {
  private readonly log = new Logger(ObjectStorage.name)

  constructor(
    private readonly config: StorageConfig = storageConfig(process.env),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Creates the bucket when missing; an existing one is fine. Never blocks boot. */
  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return
    try {
      await this.ensureBucket()
    } catch (error) {
      this.log.error(`bucket check failed: ${(error as Error).message}`)
    }
  }

  async ensureBucket() {
    const res = await fetch(this.sign('PUT', '', this.config.endpoint, 60), {
      method: 'PUT',
    })
    // 409 BucketAlreadyOwnedByYou: already there.
    if (!res.ok && res.status !== 409) {
      throw new Error(`create bucket: HTTP ${res.status}`)
    }
  }

  presignUpload(key: string, type: AudioType, size: number): Upload {
    const headers = {
      'Content-Type': type,
      'Content-Length': String(size),
    }
    return {
      url: this.sign(
        'PUT',
        key,
        this.config.publicUrl,
        UPLOAD_TTL_SECONDS,
        headers,
      ),
      method: 'PUT',
      headers,
      expiresIn: UPLOAD_TTL_SECONDS,
    }
  }

  presignDownload(key: string) {
    return this.sign('GET', key, this.config.publicUrl, PLAYBACK_TTL_SECONDS)
  }

  /** Server-side copy; false when the source was never uploaded. */
  async copy(from: string, to: string): Promise<boolean> {
    const source = `/${[this.config.bucket, ...from.split('/')].map(encodeURIComponent).join('/')}`
    const headers = { 'x-amz-copy-source': source }
    const res = await fetch(
      this.sign('PUT', to, this.config.endpoint, 60, headers),
      { method: 'PUT', headers },
    )
    // S3 may answer 200 with an <Error> body when a copy fails midway.
    const text = await res.text()
    // Only a missing source means "never uploaded"; a missing bucket is a fault.
    if (res.status === 404 && text.includes('NoSuchKey')) return false
    if (!res.ok || text.includes('<Error>')) {
      throw new Error(`copy object: HTTP ${res.status}`)
    }
    return true
  }

  private sign(
    method: 'GET' | 'PUT' | 'HEAD',
    key: string,
    origin: string,
    expires: number,
    headers?: Record<string, string>,
  ) {
    const path = [this.config.bucket, ...key.split('/').filter(Boolean)]
      .map(encodeURIComponent)
      .join('/')
    return presignUrl({
      method,
      url: new URL(`${origin}/${path}`),
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      region: this.config.region,
      now: this.clock(),
      expires,
      headers,
    })
  }
}
