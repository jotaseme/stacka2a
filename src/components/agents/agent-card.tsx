import Link from "next/link";
import type { A2AAgent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { QualityScoreBadge } from "./quality-score-badge";

interface AgentCardProps {
  agent: A2AAgent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="card-hover group flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-5 transition-all hover:border-accent/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-text-primary group-hover:text-accent transition-colors">
            {agent.name}
          </h3>
          <p className="text-xs text-text-tertiary">{agent.provider.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <QualityScoreBadge agent={agent} size="sm" />
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-text-secondary leading-relaxed">
        {agent.description}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
        {agent.githubStars > 0 && (
          <span className="inline-flex items-center gap-1 text-text-tertiary">
            <StarIcon />
            {agent.githubStars.toLocaleString()}
          </span>
        )}
        <Badge variant="outline">{agent.category}</Badge>
        {agent.framework !== "custom" && (
          <Badge variant="outline">{agent.framework}</Badge>
        )}
        {agent.language !== "unknown" && (
          <Badge variant="outline">{agent.language}</Badge>
        )}
        {agent.official && (
          <Badge variant="default">Official</Badge>
        )}
        {agent.capabilities.streaming && (
          <Badge variant="outline">Streaming</Badge>
        )}
      </div>
    </Link>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
