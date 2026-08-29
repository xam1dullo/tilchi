'use client'

import { useEffect } from 'react'

export interface GsapApi {
  gsap: typeof import('gsap').gsap
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger
  ScrollSmoother: typeof import('gsap/ScrollSmoother').ScrollSmoother
  SplitText: typeof import('gsap/SplitText').SplitText
  ScrambleText: typeof import('gsap/ScrambleTextPlugin').ScrambleTextPlugin
  Physics2D: typeof import('gsap/Physics2DPlugin').Physics2DPlugin
}

let ready: Promise<GsapApi> | null = null

export function loadGsap(): Promise<GsapApi> {
  if (!ready) {
    ready = Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('gsap/ScrollSmoother'),
      import('gsap/SplitText'),
      import('gsap/ScrambleTextPlugin'),
      import('gsap/CustomEase'),
      import('gsap/Physics2DPlugin'),
    ]).then(([g, st, ss, sp, stx, ce, p2]) => {
      g.gsap.registerPlugin(st.ScrollTrigger, ss.ScrollSmoother, sp.SplitText, stx.default, ce.CustomEase, p2.Physics2DPlugin)
      if (!ce.CustomEase.get('tilchi')) {
        ce.CustomEase.create('tilchi', '0.16, 1, 0.3, 1')
      }
      return { gsap: g.gsap, ScrollTrigger: st.ScrollTrigger, ScrollSmoother: ss.ScrollSmoother, SplitText: sp.SplitText, ScrambleText: stx.default, Physics2D: p2.Physics2DPlugin }
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
