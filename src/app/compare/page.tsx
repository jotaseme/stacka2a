import type { Metadata } from "next";
import Link from "next/link";
import { getAllAgents } from "@/lib/data";
import { computeQualityScore } from "@/lib/quality-score";
import type { A2AAgent } from "@/lib/types";

export const metadata: Metadata = {
  title: "Compare A2A Agents",
  description:
    "Side-by-side comparisons of A2A protocol agents. Compare quality scores, capabilities, frameworks, and connection options.",
  alternates: { canonical: "https://stacka2a.dev/compare" },
};

function getTopComparisons() {
  const agents = getAllAgents();
  const byCategory = new Map<string, A2AAgent[]>();

  for (const agent of agents) {
    const list = byCategory.get(agent.category) || [];
    list.push(agent);
    byCategory.set(agent.category, list);
  }

  const groups: {
    category: string;
    pairs: { a: A2AAgent; b: A2AAgent; scoreA: number; scoreB: number }[];
  }[] = [];

  for (const [category, categoryAgents] of byCategory) {
    if (categoryAgents.length < 2) continue;

    const scored = categoryAgents
      .map((agent) => ({
        agent,
        score: computeQualityScore(agent).total,
      }))
      .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 5);
    const pairs: { a: A2AAgent; b: A2AAgent; scoreA: number; scoreB: number }[] = [];

    for (let i = 0; i < top.length && pairs.length < 3; i++) {
      for (let j = i + 1; j < top.length && pairs.length < 3; j++) {
        pairs.push({
          a: top[i].agent,
          b: top[j].agent,
          scoreA: top[i].score,
          scoreB: top[j].score,
        });
      }
    }

    if (pairs.length > 0) {
      groups.push({ category, pairs });
    }
  }

  return groups.sort((a, b) => b.pairs.length - a.pairs.length);
}

const categoryLabels: Record<string, string> = {
  "code-generation": "Code Generation",
  "data-analytics": "Data & Analytics",
  enterprise: "Enterprise & Workflow",
  infrastructure: "Infrastructure",
  "multi-agent": "Multi-Agent",
  "image-media": "Image & Media",
  "search-research": "Search & Research",
  "security-auth": "Security & Auth",
  utility: "Utility",
  finance: "Finance",
  orchestration: "Orchestration",
  "content-creation": "Content Creation",
  communication: "Communication",
};

function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 70
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : score >= 50
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-stone-500 bg-stone-50 border-stone-200";

  return (
    <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

export default function ComparePage() {
  const groups = getTopComparisons();

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      {/* Page header */}
      <div className="mb-12 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
          Compare
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
          Agent vs Agent
        </h1>
        <p className="mt-3 max-w-lg text-text-secondary leading-relaxed">
          Side-by-side comparisons of the top-scoring agents in each category.
          Pick a matchup to see the full breakdown.
        </p>
      </div>

      {/* Category groups */}
      <div className="flex flex-col gap-12">
        {groups.map((group, gi) => (
          <section
            key={group.category}
            className={`animate-fade-up stagger-${Math.min(gi + 1, 6)}`}
          >
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                {categoryLabels[group.category] || group.category}
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.pairs.map(({ a, b, scoreA, scoreB }) => (
                <Link
                  key={`${a.slug}-vs-${b.slug}`}
                  href={`/compare/${a.slug}-vs-${b.slug}`}
                  className="card-hover group relative flex flex-col rounded-2xl border border-border bg-surface-elevated p-5 transition-all hover:border-accent/30"
                >
                  {/* Agent A */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {a.name}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">{a.provider.name}</p>
                    </div>
                    <ScoreIndicator score={scoreA} />
                  </div>

                  {/* Divider */}
                  <div className="my-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      vs
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Agent B */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {b.name}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">{b.provider.name}</p>
                    </div>
                    <ScoreIndicator score={scoreB} />
                  </div>

                  {/* Arrow hint */}
                  <div className="mt-3 flex items-center justify-end">
                    <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">
                      View comparison &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
