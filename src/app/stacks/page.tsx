import type { Metadata } from "next";
import { getAllStacks } from "@/lib/data";
import { StackCard } from "@/components/stacks/stack-card";
import type { StackCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "A2A Agent Stacks",
  description:
    "Browse curated stacks of A2A agents grouped by use case, framework, and industry.",
  alternates: { canonical: "https://stacka2a.dev/stacks" },
};

const CATEGORY_META: Record<StackCategory, { title: string; description: string }> = {
  "use-case": {
    title: "By Use Case",
    description: "Stacks tailored to what you want to build",
  },
  framework: {
    title: "By Framework",
    description: "Stacks organized by agent framework",
  },
  industry: {
    title: "By Industry",
    description: "Stacks for specific industry verticals",
  },
};

const CATEGORY_ORDER: StackCategory[] = ["use-case", "framework", "industry"];

export default function StacksPage() {
  const stacks = getAllStacks();

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    ...CATEGORY_META[cat],
    stacks: stacks.filter((s) => s.category === cat),
  })).filter((g) => g.stacks.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-col gap-2 mb-12 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Collections
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          A2A Agent Stacks
        </h1>
        <p className="text-text-secondary">
          Curated collections of A2A agents for common workflows.
        </p>
      </div>
      <div className="flex flex-col gap-14">
        {grouped.map((group, gi) => (
          <section key={group.category} className={`flex flex-col gap-5 animate-fade-up stagger-${gi + 1}`}>
            <div className="flex items-end gap-3">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {group.title}
                </h2>
                <p className="text-sm text-text-secondary">
                  {group.description}
                </p>
              </div>
              <div className="h-px flex-1 bg-border mb-1" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.stacks.map((stack) => (
                <StackCard key={stack.slug} stack={stack} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
