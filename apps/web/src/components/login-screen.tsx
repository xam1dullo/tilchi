import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { confirmLogin, miniAppLogin, startLogin } from '../lib/api'
import { messages } from '../lib/i18n'
import type { Locale } from '../lib/locale'
import { initialLogin, type LoginState } from '../lib/login-flow'
import {
  WEBAPP_SCRIPT,
  injectScript,
  isMiniAppLaunch,
  memoizeLoad,
  readInitData,
} from '../lib/login-miniapp'
import { LoginRunner } from '../lib/login-runner'
import { enterApp } from '../lib/session'
import { LoginPanel } from './login-panel'

const loadWebApp = memoizeLoad(() => injectScript(WEBAPP_SCRIPT))

/** The sign-in screen of /app: wires a runner per mount to the browser and router. */
export function LoginScreen({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [state, setState] = useState<LoginState>(initialLogin)
  // The button is inert until hydration; the effect then arms it.
  const [begin, setBegin] = useState<() => void>(() => () => {})

  useEffect(() => {
    const runner = new LoginRunner(
      {
        start: startLogin,
        confirm: confirmLogin,
        miniApp: miniAppLogin,
        inMiniApp: () => isMiniAppLaunch(window.location.hash, window),
        readInitData: () => readInitData(window, loadWebApp),
        openLink: (url) => {
          window.open(url, '_blank', 'noopener')
        },
        enterApp: () => enterApp(router),
      },
      setState,
    )
    setBegin(() => () => runner.begin())
    runner.detect()
    return () => runner.dispose()
  }, [router])

  return <LoginPanel state={state} copy={messages(locale)} onBegin={begin} />
}
