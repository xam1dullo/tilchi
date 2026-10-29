import { afterEach, describe, expect, it, vi } from 'vitest'
import { ObjectStorage, UPLOAD_TTL_SECONDS, audioKey } from './object-storage'

const config = {
  endpoint: 'http://minio:9000',
  publicUrl: 'https://files.tilchi.uz',
  bucket: 'tilchi-audio',
  accessKey: 'access',
  secretKey: 'secret-secret-secret',
  region: 'us-east-1',
}

describe('audio keys', () => {
  it('hold ids only, no personal data', () => {
    expect(audioKey('att-1', 'q-1', 'audio/webm')).toBe('audio/att-1/q-1.webm')
    expect(audioKey('att-1', 'q-1', 'audio/mp4')).toBe('audio/att-1/q-1.mp4')
  })
})

describe('ObjectStorage presigning', () => {
  const storage = new ObjectStorage(
    config,
    () => new Date('2030-01-01T00:00:00Z'),
  )

  it('signs uploads for the public host, 3 minutes, type and size pinned', () => {
    const upload = storage.presignUpload('audio/a/q.webm', 'audio/webm', 1234)
    const url = new URL(upload.url)
    expect(url.origin).toBe('https://files.tilchi.uz')
    expect(url.pathname).toBe('/tilchi-audio/audio/a/q.webm')
    expect(url.searchParams.get('X-Amz-Expires')).toBe(
      String(UPLOAD_TTL_SECONDS),
    )
    expect(UPLOAD_TTL_SECONDS).toBeLessThanOrEqual(180)
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
      'content-length;content-type;host',
    )
    expect(upload.headers).toEqual({
      'Content-Type': 'audio/webm',
      'Content-Length': '1234',
    })
  })

  it('signs playback for the public host', () => {
    const url = new URL(storage.presignDownload('audio/a/q.webm'))
    expect(url.origin).toBe('https://files.tilchi.uz')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  })
})

const live = process.env.S3_TEST_ENDPOINT
describe.skipIf(!live)('ObjectStorage against a real MinIO', () => {
  const storage = new ObjectStorage({
    ...config,
    endpoint: live as string,
    publicUrl: live as string,
    bucket: `t-${Date.now()}`,
    accessKey: process.env.S3_TEST_ACCESS_KEY ?? '',
    secretKey: process.env.S3_TEST_SECRET_KEY ?? '',
  })
  const body = new Uint8Array(2048).fill(7)

  it('creates the bucket twice without error, uploads, finds and serves', async () => {
    await storage.ensureBucket()
    await storage.ensureBucket()
    const key = audioKey('att', 'q', 'audio/webm')
    expect(await storage.exists(key)).toBe(false)
    const upload = storage.presignUpload(key, 'audio/webm', body.length)
    const put = await fetch(upload.url, {
      method: 'PUT',
      headers: upload.headers,
      body,
    })
    expect(put.status).toBe(200)
    expect(await storage.exists(key)).toBe(true)
    const get = await fetch(storage.presignDownload(key))
    expect(get.status).toBe(200)
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(body)
  })

  it('refuses an upload bigger than the declared size or of another type', async () => {
    const key = audioKey('att2', 'q', 'audio/webm')
    const upload = storage.presignUpload(key, 'audio/webm', 10)
    const big = await fetch(upload.url, {
      method: 'PUT',
      headers: { ...upload.headers, 'Content-Length': '2048' },
      body,
    })
    expect(big.status).toBe(403)
    const wrongType = await fetch(upload.url, {
      method: 'PUT',
      headers: { ...upload.headers, 'Content-Type': 'text/html' },
      body: new Uint8Array(10),
    })
    expect(wrongType.status).toBe(403)
    expect(await storage.exists(key)).toBe(false)
  })

  it('refuses an expired url', async () => {
    const old = new ObjectStorage(
      {
        ...config,
        endpoint: live as string,
        publicUrl: live as string,
        bucket: 'whatever',
        accessKey: process.env.S3_TEST_ACCESS_KEY ?? '',
        secretKey: process.env.S3_TEST_SECRET_KEY ?? '',
      },
      () => new Date(Date.now() - 3600_000),
    )
    const res = await fetch(old.presignDownload('audio/a/q.webm'))
    expect(res.status).toBe(403)
  })
})

describe('bucket creation on boot', () => {
  const unreachable = new ObjectStorage({
    ...config,
    endpoint: 'http://127.0.0.1:1',
  })
  const original = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = original
    vi.restoreAllMocks()
  })

  it('does nothing in tests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    process.env.NODE_ENV = 'test'
    await unreachable.onApplicationBootstrap()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('tries once elsewhere and never blocks boot when MinIO is down', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    process.env.NODE_ENV = 'production'
    await expect(unreachable.onApplicationBootstrap()).resolves.toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('treats an existing bucket (409) as done and other failures as errors', async () => {
    const answer = (status: number) =>
      vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status }))
    answer(409)
    await expect(unreachable.ensureBucket()).resolves.toBeUndefined()
    answer(403)
    await expect(unreachable.ensureBucket()).rejects.toThrow(/403/)
  })
})
