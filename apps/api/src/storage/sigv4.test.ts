import { describe, expect, it } from 'vitest'
import { presignUrl } from './sigv4'

const base = {
  accessKey: 'AKIAIOSFODNN7EXAMPLE',
  secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  now: new Date('2013-05-24T00:00:00Z'),
}

describe('presignUrl', () => {
  it('matches the AWS documentation example signature', () => {
    const url = presignUrl({
      ...base,
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      expires: 86400,
    })
    expect(url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    )
    expect(url).toContain('X-Amz-Expires=86400')
  })

  it('signs the headers the client must send', () => {
    const url = presignUrl({
      ...base,
      method: 'PUT',
      url: new URL('http://minio:9000/b/audio/a/q.webm'),
      expires: 180,
      headers: { 'Content-Type': 'audio/webm', 'Content-Length': '10' },
    })
    expect(url).toContain(
      'X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost',
    )
  })

  it('changes the signature when a signed header changes', () => {
    const sign = (length: string) =>
      presignUrl({
        ...base,
        method: 'PUT',
        url: new URL('http://minio:9000/b/k'),
        expires: 180,
        headers: { 'content-length': length },
      })
    expect(sign('1')).not.toBe(sign('2'))
  })

  it('percent-encodes the characters encodeURIComponent leaves alone', () => {
    const url = presignUrl({
      ...base,
      method: 'GET',
      url: new URL("https://h/b/k?a=!'()*"),
      expires: 60,
    })
    expect(url).toContain('a=%21%27%28%29%2A')
  })

  it('sorts extra query parameters in with the signing ones', () => {
    const url = presignUrl({
      ...base,
      method: 'GET',
      url: new URL('https://h/b/k?zeta=1&alpha=2'),
      expires: 60,
    })
    const at = (part: string) => url.indexOf(part)
    expect(at('X-Amz-SignedHeaders')).toBeLessThan(at('alpha=2'))
    expect(at('alpha=2')).toBeLessThan(at('zeta=1'))
  })
})
