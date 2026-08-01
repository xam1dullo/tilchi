import { NavMotion } from '@/components/NavMotion'
import { SmoothScroll } from '@/components/gsap/SmoothScroll'
import { Hero } from '@/components/gsap/Hero'
import { TrustBand } from '@/components/sections/TrustBand'
import { Programs } from '@/components/sections/Programs'
import { Method } from '@/components/sections/Method'
import { Demo } from '@/components/sections/Demo'
import { Pricing } from '@/components/sections/Pricing'
import { Faq } from '@/components/sections/Faq'
import { Booking } from '@/components/sections/Booking'
import { Research } from '@/components/sections/Research'
import { JsonLd } from '@/components/JsonLd'
import { faqLd, graphLd, groupCourseLd, ieltsCourseLd, orgLd, teacherLd } from '@/lib/seo'

export default function Home() {
  return (
    <>
      <JsonLd data={graphLd(orgLd, teacherLd, ieltsCourseLd, groupCourseLd, faqLd)} />
      <NavMotion />
      <SmoothScroll>
        <Hero />
        <TrustBand />
        <Programs />
        <Method />
        <Demo />
        <Pricing />
        <Faq />
        <Booking />
        <Research />
      </SmoothScroll>
    </>
  )
}
