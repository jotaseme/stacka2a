import Link from "next/link";
import type { A2AAgent, Stack } from "@/lib/types";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { AgentCard } from "@/components/agents/agent-card";
import { StackSnippetSection } from "./stack-snippet-section";

interface StackDetailProps {
  stack: Stack;
  agents: A2AAgent[];
}

export function StackDetail({ stack, agents }: StackDetailProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-4 animate-fade-up">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{stack.category}</Badge>
            <DifficultyBadge difficulty={stack.difficulty} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            {stack.name}
          </h1>
          <p className="text-lg leading-relaxed text-text-secondary">
            {stack.description}
          </p>
        </div>

        {/* Agents in this stack */}
        <section className="flex flex-col gap-4 animate-fade-up stagger-2">
          <h2 className="text-xl font-semibold text-text-primary">
            Agents ({agents.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map((agent) => (
              <AgentCard key={agent.slug} agent={agent} />
            ))}
          </div>
        </section>

        {/* Connection snippets — selectable by agent */}
        {agents.length > 0 && (
          <section className="flex flex-col gap-3 animate-fade-up stagger-3">
            <h2 className="text-xl font-semibold text-text-primary">
              Getting Started
            </h2>
            <p className="text-sm text-text-secondary">
              Pick an agent to see setup instructions.
            </p>
            <StackSnippetSection agents={agents} />
          </section>
        )}

        {/* Related blog post */}
        {stack.blogPost && (
          <section className="border-t border-border pt-6 animate-fade-up stagger-4">
            <Link
              href={`/blog/${stack.blogPost}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Read the guide for this stack &rarr;
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
