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
