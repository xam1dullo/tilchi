import { createHash, createHmac } from 'node:crypto'

const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest()

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex')

/** RFC 3986 percent-encoding, as SigV4 demands (encodeURIComponent leaves !'()*). */
const encode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )

export type PresignInput = {
  method: 'GET' | 'PUT' | 'HEAD'
  /** The exact URL the client will call; the host is part of the signature. */
  url: URL
  accessKey: string
  secretKey: string
  region: string
  now: Date
  /** Seconds the URL stays valid. */
  expires: number
  /** Headers the caller must send with exactly these values. `host` is implied. */
  headers?: Record<string, string>
}

/**
 * AWS Signature V4 query-string signing for S3-compatible servers (MinIO).
 * Unsigned payload: the signed headers (content-type, content-length) are what
 * pins an upload to the declared type and size.
 */
export function presignUrl(input: PresignInput): string {
  const stamp = input.now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const day = stamp.slice(0, 8)
  const scope = `${day}/${input.region}/s3/aws4_request`
  const headers: Record<string, string> = { host: input.url.host }
  for (const [name, value] of Object.entries({ ...input.headers })) {
    headers[name.toLowerCase()] = value.trim()
  }
  const names = Object.keys(headers).sort()
  const query: [string, string][] = [
    ...input.url.searchParams.entries(),
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${input.accessKey}/${scope}`],
    ['X-Amz-Date', stamp],
    ['X-Amz-Expires', String(input.expires)],
    ['X-Amz-SignedHeaders', names.join(';')],
  ]
  // Plain code-unit order, as SigV4 requires. Sorting "k=v" strings equals
  // sorting by key unless one key is a prefix of another, which we never sign.
  const canonicalQuery = query
    .map(([k, v]) => `${encode(k)}=${encode(v)}`)
    .sort()
    .join('&')
  const canonical = [
    input.method,
    input.url.pathname,
    canonicalQuery,
    ...names.map((n) => `${n}:${headers[n]}`),
    '',
    names.join(';'),
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join(
    '\n',
  )
  const key = hmac(
    hmac(hmac(hmac(`AWS4${input.secretKey}`, day), input.region), 's3'),
    'aws4_request',
  )
  const signature = createHmac('sha256', key).update(toSign).digest('hex')
  return `${input.url.origin}${input.url.pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`
}
