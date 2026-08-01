'use client'

import { useEffect } from 'react'

export interface GsapApi {
  gsap: typeof import('gsap').gsap
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger
  ScrollSmoother: typeof import('gsap/ScrollSmoother').ScrollSmoother
  SplitText: typeof import('gsap/SplitText').SplitText
}

let ready: Promise<GsapApi> | null = null

export function loadGsap(): Promise<GsapApi> {
  if (!ready) {
    ready = Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('gsap/ScrollSmoother'),
      import('gsap/SplitText'),
      import('gsap/CustomEase'),
    ]).then(([g, st, ss, sp, ce]) => {
      g.gsap.registerPlugin(st.ScrollTrigger, ss.ScrollSmoother, sp.SplitText, ce.CustomEase)
      if (!ce.CustomEase.get('tilchi')) {
        ce.CustomEase.create('tilchi', '0.16, 1, 0.3, 1')
      }
      return { gsap: g.gsap, ScrollTrigger: st.ScrollTrigger, ScrollSmoother: ss.ScrollSmoother, SplitText: sp.SplitText }
    })
  }
  return ready
}

export function useGsap(effect: (api: GsapApi) => (() => void) | void, deps: React.DependencyList) {
  useEffect(() => {
    let dispose: (() => void) | undefined
    let alive = true
    loadGsap().then((api) => {
      if (!alive) return
      const result = effect(api)
      if (typeof result === 'function') dispose = result
    })
    return () => {
      alive = false
      dispose?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
