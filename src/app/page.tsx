import Link from "next/link";
import { getAllStacks, getAllAgents } from "@/lib/data";
import { StackCard } from "@/components/stacks/stack-card";
import { HeroSection } from "@/components/home/hero-section";
import { StatsSection } from "@/components/home/stats-section";

const featuredSlugs = [
  "code-generation",
  "enterprise-workflow",
  "google-adk-stack",
  "multi-agent",
  "data-analytics",
  "content-creation",
];

const whyCurated = [
  {
    icon: ScoreIcon,
    title: "Quality scored",
    description:
      "Every agent is scored on maintenance, protocol compliance, and community traction. No abandoned repos, no broken endpoints.",
  },
  {
    icon: SnippetIcon,
    title: "Instant connection",
    description:
      "Ready-to-run code snippets for Python, TypeScript, Java, Go, and C#. Connect to any agent in seconds.",
  },
  {
    icon: CrawlerIcon,
    title: "Auto-discovered",
    description:
      "Our crawler indexes agents from GitHub, registries, and official samples every day. Always fresh data.",
  },
];

export default function Home() {
  const allStacks = getAllStacks();
  const allAgents = getAllAgents();
  const featured = featuredSlugs
    .map((slug) => allStacks.find((s) => s.slug === slug))
    .filter(Boolean);

  const categories = new Set(allAgents.map((a) => a.category));
  const frameworks = new Set(allAgents.filter((a) => a.framework !== "custom").map((a) => a.framework));

  const stats = [
    { value: allAgents.length, label: "Agents indexed" },
    { value: allStacks.length, label: "Curated stacks" },
    { value: categories.size, label: "Categories" },
    { value: frameworks.size, label: "Frameworks" },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <HeroSection stackCount={allStacks.length} agentCount={allAgents.length} />

      {/* Featured Stacks */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">
              Curated
            </p>
            <h2 className="font-bold text-2xl tracking-tight text-text-primary sm:text-3xl">
              Popular Stacks
            </h2>
          </div>
          <Link
            href="/stacks"
            className="text-sm font-medium text-text-secondary hover:text-accent transition-colors"
          >
            View all &rarr;
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((stack, i) =>
            stack ? (
              <div key={stack.slug} className={`animate-fade-up stagger-${i + 1}`}>
                <StackCard stack={stack} />
              </div>
            ) : null
          )}
        </div>
      </section>

      {/* Why Curated */}
      <section className="relative border-y border-border">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/80 to-background" />
        <div className="relative mx-auto max-w-5xl px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">
              Why us
            </p>
            <h2 className="font-bold text-2xl tracking-tight text-text-primary sm:text-3xl mb-3">
              Why StackA2A?
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto leading-relaxed">
              The A2A ecosystem is growing fast. Most directories are bare lists.
              We go deeper — scoring quality, testing capabilities, generating
              connection code.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {whyCurated.map((item, i) => (
              <div key={item.title} className={`animate-fade-up stagger-${i + 1} flex flex-col gap-4 rounded-2xl border border-border bg-surface-elevated p-6`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <item.icon />
                </span>
                <h3 className="text-lg font-semibold text-text-primary">
                  {item.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <StatsSection stats={stats} />

      {/* Bottom CTA */}
      <section className="border-t border-border">
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-20 text-center">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[600px] rounded-full bg-accent/5 blur-3xl" />
          </div>
          <h2 className="font-bold text-2xl tracking-tight text-text-primary sm:text-3xl">
            Ready to discover A2A agents?
          </h2>
          <p className="text-text-secondary max-w-md leading-relaxed">
            Browse quality-scored agents and connect them to your applications
            in seconds.
          </p>
          <Link
            href="/agents"
            className="group rounded-xl bg-accent px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20"
          >
            Browse Agents
            <span className="ml-1.5 inline-block transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function ScoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SnippetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function CrawlerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
