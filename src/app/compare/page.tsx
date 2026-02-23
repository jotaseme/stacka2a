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
};

export default function ComparePage() {
  const groups = getTopComparisons();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          Compare A2A Agents
        </h1>
        <p className="text-text-secondary">
          Side-by-side comparisons of top agents in each category.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.category}>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              {categoryLabels[group.category] || group.category}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.pairs.map(({ a, b, scoreA, scoreB }) => (
                <Link
                  key={`${a.slug}-vs-${b.slug}`}
                  href={`/compare/${a.slug}-vs-${b.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-white p-4 transition-all hover:border-accent/30 hover:shadow-sm"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium text-text-primary group-hover:text-accent">
                      {a.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      Score: {scoreA}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-text-secondary">
                    vs
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col items-end gap-1">
                    <span className="truncate text-sm font-medium text-text-primary group-hover:text-accent">
                      {b.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      Score: {scoreB}
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
