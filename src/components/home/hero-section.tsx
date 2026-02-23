import Link from "next/link";

interface HeroSectionProps {
  stackCount: number;
  agentCount: number;
}

export function HeroSection({ stackCount, agentCount }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-20 right-0 h-[300px] w-[400px] rounded-full bg-cyan-500/5 blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--color-text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-primary) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 pt-24 pb-20 text-center">
        {/* Status pill */}
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-1.5 text-xs font-medium text-text-secondary shadow-sm">
            <span className="glow-dot" />
            {agentCount} agents curated into {stackCount} stacks
          </span>
        </div>

        {/* Main heading */}
        <h1 className="animate-fade-up stagger-1 text-5xl font-bold tracking-tight text-text-primary sm:text-6xl lg:text-7xl">
          The best{" "}
          <span className="gradient-text">A2A agents</span>
          <br />
          <span className="text-text-secondary">scored & ready to connect</span>
        </h1>

        {/* Subheading */}
        <p className="animate-fade-up stagger-2 max-w-lg text-lg text-text-secondary leading-relaxed">
          Hundreds of A2A agents exist. Most lack docs, tests, or real
          capabilities. We crawl, score, and curate the ones that actually work
          — with connection snippets for every SDK.
        </p>

        {/* CTAs */}
        <div className="animate-fade-up stagger-3 flex gap-3">
          <Link
            href="/agents"
            className="group relative rounded-xl bg-accent px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20"
          >
            Browse Agents
            <span className="ml-1.5 inline-block transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </Link>
          <Link
            href="/stacks"
            className="rounded-xl border border-border bg-surface-elevated px-7 py-3 text-sm font-semibold text-text-primary transition-all hover:border-accent/30 hover:shadow-sm"
          >
            View Stacks
          </Link>
        </div>
      </div>
    </section>
  );
}
