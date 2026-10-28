import { describe, expect, it, vi } from 'vitest'
import {
  WEBAPP_SCRIPT,
  isMiniAppLaunch,
  memoizeLoad,
  readInitData,
} from './login-miniapp'

type Host = Pick<Window, 'Telegram'>

describe('isMiniAppLaunch', () => {
  it('is true for the hash Telegram puts on a Mini App launch', () => {
    const hash =
      '#tgWebAppData=query_id%3DAAH%26hash%3Dabc&tgWebAppVersion=7.10&tgWebAppPlatform=android'
    expect(isMiniAppLaunch(hash, {})).toBe(true)
  })

  it('is false for an ordinary page', () => {
    for (const hash of [
      '',
      '#',
      '#top',
      '#login=abc',
      '#tgWebAppVersion=7.10',
      '#x=tgWebAppData',
    ]) {
      expect(isMiniAppLaunch(hash, {})).toBe(false)
    }
  })

  it('is true when the Telegram script already holds initData', () => {
    const host: Host = { Telegram: { WebApp: { initData: 'query_id=1' } } }
    expect(isMiniAppLaunch('', host)).toBe(true)
  })

  it('is false when the Telegram script holds no initData', () => {
    for (const host of [
      { Telegram: { WebApp: { initData: '' } } },
      { Telegram: { WebApp: {} } },
      { Telegram: {} },
    ] satisfies Host[]) {
      expect(isMiniAppLaunch('', host)).toBe(false)
    }
  })
})

describe('readInitData', () => {
  it('loads the Telegram script only when it is not there yet', async () => {
    const host: Host = {}
    const load = vi.fn(async () => {
      host.Telegram = { WebApp: { initData: 'query_id=1&hash=2' } }
    })
    await expect(readInitData(host, load)).resolves.toBe('query_id=1&hash=2')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does not load the script a second time', async () => {
    const host: Host = { Telegram: { WebApp: { initData: 'query_id=1' } } }
    const load = vi.fn(async () => {})
    await expect(readInitData(host, load)).resolves.toBe('query_id=1')
    expect(load).not.toHaveBeenCalled()
  })

  it('tells Telegram the app is ready', async () => {
    const ready = vi.fn()
    const host: Host = { Telegram: { WebApp: { initData: 'x=1', ready } } }
    await readInitData(host, async () => {})
    expect(ready).toHaveBeenCalledTimes(1)
  })

  it('returns null when there is no initData to send', async () => {
    for (const host of [
      { Telegram: { WebApp: { initData: '' } } },
      { Telegram: { WebApp: {} } },
      {},
    ] satisfies Host[]) {
      await expect(readInitData(host, async () => {})).resolves.toBeNull()
    }
  })

  it('lets a failed script load reject', async () => {
    const load = async () => {
      throw new Error('script_failed')
    }
    await expect(readInitData({}, load)).rejects.toThrow('script_failed')
  })

  it('names the official script', () => {
    expect(WEBAPP_SCRIPT).toBe('https://telegram.org/js/telegram-web-app.js')
  })
})

describe('memoizeLoad', () => {
  it('runs the load once for many callers', async () => {
    const load = vi.fn(async () => {})
    const once = memoizeLoad(load)
    const first = once()
    const second = once()
    await Promise.all([first, second])
    await once()
    expect(load).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('tries again after a failed load', async () => {
    const load = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const once = memoizeLoad(load)
    await expect(once()).rejects.toThrow('offline')
    await expect(once()).resolves.toBeUndefined()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('keeps a finished load', async () => {
    const load = vi.fn(async () => {})
    const once = memoizeLoad(load)
    await once()
    await once()
    expect(load).toHaveBeenCalledTimes(1)
  })
})
