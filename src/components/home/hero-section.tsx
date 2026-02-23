import Link from "next/link";

interface HeroSectionProps {
  stackCount: number;
  agentCount: number;
}

export function HeroSection({ stackCount, agentCount }: HeroSectionProps) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-20 pb-16 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        {agentCount} agents curated into {stackCount} stacks
      </span>
      <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
        The best{" "}
        <span className="text-accent">A2A agents</span>
        <br />
        scored &amp; ready to connect
      </h1>
      <p className="max-w-lg text-lg text-text-secondary leading-relaxed">
        Hundreds of A2A agents exist. Most lack docs, tests, or real
        capabilities. We crawl, score, and curate the ones that actually work
        — with connection snippets for every SDK.
      </p>
      <div className="flex gap-3">
        <Link
          href="/agents"
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Browse Agents
        </Link>
        <Link
          href="/stacks"
          className="rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
        >
          View Stacks
        </Link>
      </div>
    </section>
  );
}
