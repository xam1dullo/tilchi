export type Figure = { label: string; value: number | string }

/** One quiet line of counts: "Tests 1 · Questions 2". Zero counts are left out. */
export function Figures({ items }: { items: Figure[] }) {
  const shown = items.filter((item) => item.value !== 0)
  if (shown.length === 0) return null
  return (
    <p className="figures">
      {shown.map((item, i) => (
        <span key={item.label}>
          {/* A real space on each side: the dot is visual only. */}
          {i > 0 ? (
            <>
              {' '}
              <span aria-hidden="true">·</span>{' '}
            </>
          ) : null}
          {item.label} <span className="num">{item.value}</span>
        </span>
      ))}
    </p>
  )
}
