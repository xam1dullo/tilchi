export type CabinetStat = { label: string; value: number; hint: string }

export function CabinetStats({ items }: { items: CabinetStat[] }) {
  return (
    <dl className="cabinet-stats">
      {items.map(({ label, value, hint }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
          <dd className="cabinet-stat-hint">{hint}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CabinetIcon() {
  return (
    <span className="cabinet-icon" aria-hidden="true">
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path d="M6 3h9l3 3v15H6zM14 3v5h4M9 12h6M9 16h6" />
      </svg>
    </span>
  )
}
