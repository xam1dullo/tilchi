export const WEBAPP_SCRIPT = 'https://telegram.org/js/telegram-web-app.js'

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string
        ready?: () => void
        openLink?: (url: string) => void
      }
    }
  }
}

type Host = Pick<Window, 'Telegram'>

/**
 * Telegram opens a Mini App with `#tgWebAppData=...` in the URL, so the
 * official script only has to load when this is true.
 */
export function isMiniAppLaunch(hash: string, host: Host) {
  const launch = new URLSearchParams(hash.replace(/^#/, ''))
  return launch.has('tgWebAppData') || Boolean(host.Telegram?.WebApp?.initData)
}

/** null: Telegram gave nothing to prove who the user is. */
export async function readInitData(
  host: Host,
  load: () => Promise<void>,
): Promise<string | null> {
  if (!host.Telegram?.WebApp) await load()
  const app = host.Telegram?.WebApp
  app?.ready?.()
  return app?.initData || null
}

/** One load for every caller; a failed load can be tried again. */
export function memoizeLoad(load: () => Promise<void>) {
  let pending: Promise<void> | undefined
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }
}

export function injectScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      reject(new Error('script_failed'))
    }
    document.head.append(script)
  })
}
