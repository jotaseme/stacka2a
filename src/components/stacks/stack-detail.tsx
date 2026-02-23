import Link from "next/link";
import type { A2AAgent, Stack } from "@/lib/types";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { AgentCard } from "@/components/agents/agent-card";
import { SnippetPreview } from "./snippet-preview";

interface StackDetailProps {
  stack: Stack;
  agents: A2AAgent[];
}

export function StackDetail({ stack, agents }: StackDetailProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{stack.category}</Badge>
            <DifficultyBadge difficulty={stack.difficulty} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            {stack.name}
          </h1>
          <p className="text-lg leading-relaxed text-text-secondary">
            {stack.description}
          </p>
        </div>

        {/* Agents in this stack */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-text-primary">
            Agents ({agents.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map((agent) => (
              <AgentCard key={agent.slug} agent={agent} />
            ))}
          </div>
        </section>

        {/* Connection snippet for first agent */}
        {agents.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-text-primary">
              Quick Connect — {agents[0].name}
            </h2>
            <SnippetPreview agent={agents[0]} />
          </section>
        )}

        {/* Related blog post */}
        {stack.blogPost && (
          <section className="border-t border-border pt-6">
            <Link
              href={`/blog/${stack.blogPost}`}
              className="text-sm font-medium text-accent hover:opacity-80 transition-opacity"
            >
              Read the guide for this stack &rarr;
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
