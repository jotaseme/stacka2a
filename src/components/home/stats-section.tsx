interface StatsSectionProps {
  stats: { value: number; label: string }[];
}

export function StatsSection({ stats }: StatsSectionProps) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-center gap-8 text-center sm:gap-16">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-text-primary tabular-nums">
              {stat.value}
            </span>
            <span className="text-sm text-text-secondary">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
