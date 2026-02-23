import Link from "next/link";
import type { A2AAgent, Stack } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { QualityScoreBadge } from "./quality-score-badge";
import { SnippetPreview } from "@/components/stacks/snippet-preview";

interface AgentDetailProps {
  agent: A2AAgent;
  stacks: Stack[];
}

export function AgentDetail({ agent, stacks }: AgentDetailProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{agent.category}</Badge>
            {agent.official && <Badge variant="default">Official</Badge>}
            {agent.framework !== "custom" && (
              <Badge variant="outline">{agent.framework}</Badge>
            )}
            {agent.language !== "unknown" && (
              <Badge variant="outline">{agent.language}</Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              {agent.name}
            </h1>
            <QualityScoreBadge agent={agent} size="lg" />
          </div>
          <p className="text-text-secondary">
            by{" "}
            {agent.provider.url ? (
              <a
                href={agent.provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary underline decoration-accent underline-offset-2"
              >
                {agent.provider.name}
              </a>
            ) : (
              agent.provider.name
            )}
          </p>
          <p className="text-lg leading-relaxed text-text-secondary">
            {agent.description}
          </p>

          {/* Metrics */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
            {agent.githubStars > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <StarIcon />
                {agent.githubStars.toLocaleString()} stars
              </span>
            )}
            <span>Updated {agent.lastUpdated}</span>
            {agent.license !== "unknown" && (
              <Badge variant="outline">{agent.license}</Badge>
            )}
          </div>
        </div>

        {/* Capabilities */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-text-primary">
            Capabilities
          </h2>
          <div className="flex flex-wrap gap-2">
            <CapabilityBadge label="Streaming" enabled={agent.capabilities.streaming} />
            <CapabilityBadge label="Push Notifications" enabled={agent.capabilities.pushNotifications} />
            <CapabilityBadge label="Multi-Turn" enabled={agent.capabilities.multiTurn} />
            <Badge variant="outline">Auth: {agent.authType}</Badge>
          </div>
        </section>

        {/* Skills */}
        {agent.skills.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-text-primary">
              Skills ({agent.skills.length})
            </h2>
            <div className="flex flex-col gap-2">
              {agent.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-xl border border-border p-4"
                >
                  <h3 className="font-medium text-text-primary">{skill.name}</h3>
                  {skill.description && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {skill.description}
                    </p>
                  )}
                  {skill.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {skill.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        {agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agent.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Connection Snippets */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-text-primary">
            Quick Connect
          </h2>
          <SnippetPreview agent={agent} />
        </section>

        {/* Part of these stacks */}
        {stacks.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-text-primary">
              Part of these stacks
            </h2>
            <div className="flex flex-wrap gap-2">
              {stacks.map((stack) => (
                <Link
                  key={stack.slug}
                  href={`/stacks/${stack.slug}`}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
                >
                  {stack.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Links */}
        <section className="flex gap-3 border-t border-border pt-6">
          {agent.repository && (
            <a
              href={agent.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-text-primary px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              <GithubIcon />
              View on GitHub
            </a>
          )}
          {agent.agentCardUrl && (
            <a
              href={agent.agentCardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
            >
              Agent Card
            </a>
          )}
        </section>
      </div>
    </div>
  );
}

function CapabilityBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
        enabled
          ? "bg-emerald-50 text-emerald-700"
          : "bg-zinc-100 text-zinc-400"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-zinc-300"}`} />
      {label}
    </span>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
