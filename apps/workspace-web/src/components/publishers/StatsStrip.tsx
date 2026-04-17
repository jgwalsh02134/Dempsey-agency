type Stat = {
  label: string;
  value: string | number;
  hint?: string;
};

type StatsStripProps = {
  stats: Stat[];
};

export function StatsStrip({ stats }: StatsStripProps) {
  return (
    <div className="publishers-stats">
      {stats.map((s) => (
        <div key={s.label} className="card stat-card">
          <div className="stat-value">{s.value}</div>
          <div className="stat-label">{s.label}</div>
          {s.hint && <div className="stat-hint">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}
