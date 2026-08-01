import type { ReactNode } from 'react'
import { Reveal } from '@/components/gsap/Reveal'
import { SplitHeading } from '@/components/gsap/SplitHeading'
import { programs, type ProgramIconId } from '@/lib/domain/programs'

const ICONS: Record<ProgramIconId, ReactNode> = {
  kids: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  ),
  ielts: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  adults: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
}

const check = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

export function Programs() {
  return (
    <section className="section" id="dastur">
      <div className="container">
        <div className="prog-grid">
          <aside className="prog-aside">
            <p className="eyebrow">
              Dastur
            </p>
            <SplitHeading className="h2">
              Bitta o'qituvchi. <em>Uch xil yondashuv.</em>
            </SplitHeading>
            <p className="lede">
              Har bir yosh guruhi boshqacha o'rganadi — shuning uchun material, tezlik va uslub har biriga alohida
              moslashtiriladi.
            </p>
          </aside>

          <div className="prog-list">
            {programs.map((p) => (
              <Reveal key={p.title}>
                <article className="program">
                  <span className="program-icon" aria-hidden="true">
                    {ICONS[p.iconId]}
                  </span>
                  <div>
                    <p className="program-age">{p.age}</p>
                    <h3>{p.title}</h3>
                    <p className="program-desc">{p.desc}</p>
                    <ul>
                      {p.items.map((i) => (
                        <li key={i}>
                          {check} {i}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
