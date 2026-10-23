import { SplitHeading } from '@/components/gsap/SplitHeading'
import { ScrubList } from '@/components/gsap/ScrubList'
import { ScrubSection } from '@/components/gsap/ScrubSection'
import { programs } from '@/lib/domain/programs'

const arrow = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
)

export function Programs() {
  return (
    <ScrubSection className="section" y={26} id="programs">
      <div className="container">
        <div className="sec-split">
          <div>
            <p className="eyebrow">Dastur</p>
            <SplitHeading className="h2">
              Bitta o'qituvchi. <em>Uch xil yondashuv.</em>
            </SplitHeading>
          </div>
          <p className="lede">
            Har bir yosh guruhi boshqacha o'rganadi — shuning uchun material, tezlik va uslub har biriga alohida
            moslashtiriladi.
          </p>
        </div>

        <ScrubList className="prog-rows rows">
          {programs.map((p, i) => (
            <article className="prog-row row" key={p.title}>
              <span className="prog-index num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="prog-head">
                <p className="program-age">{p.age}</p>
                <h3>{p.title}</h3>
              </div>
              <div className="prog-body">
                <p className="program-desc">{p.desc}</p>
                <ul className="program-items">
                  {p.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <a className="prog-cta" href="/#booking" aria-label={`${p.title} uchun demo dars`}>
                {arrow}
              </a>
            </article>
          ))}
        </ScrubList>
      </div>
    </ScrubSection>
  )
}
