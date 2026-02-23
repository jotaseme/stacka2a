interface StatsSectionProps {
  stats: { value: number; label: string }[];
}

export function StatsSection({ stats }: StatsSectionProps) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`animate-fade-up stagger-${i + 1} flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface-elevated p-6 text-center`}
          >
            <span className="text-3xl font-bold text-text-primary tabular-nums tracking-tight">
              {stat.value}
            </span>
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
