import { describe, expect, it } from 'vitest'
import { deviceLabel } from './device'

const agents = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  firefoxLinux:
    'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  chromeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  operaWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
}

describe('deviceLabel', () => {
  it.each([
    [agents.chromeWindows, 'Chrome, Windows'],
    [agents.edgeWindows, 'Edge, Windows'],
    [agents.firefoxLinux, 'Firefox, Linux'],
    [agents.safariMac, 'Safari, macOS'],
    [agents.safariIphone, 'Safari, iOS'],
    [agents.chromeAndroid, 'Chrome, Android'],
    [agents.chromeIphone, 'Chrome, iOS'],
    [agents.operaWindows, 'Opera, Windows'],
  ])('names the browser and system for %#', (userAgent, label) => {
    expect(deviceLabel(userAgent)).toBe(label)
  })

  it('falls back to a plain word when nothing is recognised', () => {
    expect(deviceLabel(undefined)).toBe('Browser')
    expect(deviceLabel('curl/8.5.0')).toBe('Browser')
  })

  it('never echoes caller supplied text into the label', () => {
    const label = deviceLabel('Chrome/1 <b>click here</b> https://evil.example')
    expect(label).toBe('Chrome')
  })
})
