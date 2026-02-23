import Link from "next/link";
import type { A2AAgent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { QualityScoreBadge } from "./quality-score-badge";
import {
  computeQualityScore,
  type QualityBreakdown,
} from "@/lib/quality-score";

interface AgentComparisonProps {
  agents: A2AAgent[];
}

export function AgentComparison({ agents }: AgentComparisonProps) {
  const breakdowns: QualityBreakdown[] = agents.map(computeQualityScore);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
          Comparison
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          {agents.map((a) => a.name).join(" vs ")}
        </h1>
        <p className="mt-2 text-text-secondary">
          Side-by-side comparison of {agents.length} A2A agents
        </p>
      </div>

      {/* Agent headers as cards on mobile */}
      <div className="mt-8 grid gap-3 sm:hidden">
        {agents.map((agent, i) => (
          <Link
            key={agent.slug}
            href={`/agents/${agent.slug}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-4 transition-colors hover:border-accent/30"
          >
            <QualityScoreBadge agent={agent} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-text-primary">{agent.name}</p>
              <p className="text-xs text-text-secondary">{agent.provider.name}</p>
            </div>
            <Badge variant="outline">{agent.framework}</Badge>
          </Link>
        ))}
      </div>

      {/* Comparison table */}
      <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-surface-elevated animate-fade-up stagger-2">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Property
              </th>
              {agents.map((agent) => (
                <th
                  key={agent.slug}
                  className="p-4 text-left font-semibold text-text-primary"
                >
                  <Link
                    href={`/agents/${agent.slug}`}
                    className="transition-colors hover:text-accent"
                  >
                    {agent.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Quality Score">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <QualityScoreBadge agent={agent} size="sm" />
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Provider" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4 text-text-primary font-medium">
                  {agent.provider.name}
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Framework">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <Badge variant="outline">{agent.framework}</Badge>
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Language" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <Badge variant="outline">{agent.language}</Badge>
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Category">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <Badge variant="outline">{agent.category}</Badge>
                </td>
              ))}
            </CompareRow>

            <CompareRow label="GitHub Stars" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4 text-text-primary tabular-nums">
                  {agent.githubStars > 0
                    ? agent.githubStars.toLocaleString()
                    : "—"}
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Last Updated">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4 text-text-secondary">
                  {agent.lastUpdated}
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Skills" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4 text-text-primary tabular-nums">
                  {agent.skills.length}
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Streaming">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <BoolBadge value={agent.capabilities.streaming} />
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Multi-Turn" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <BoolBadge value={agent.capabilities.multiTurn} />
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Push Notifications">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <BoolBadge value={agent.capabilities.pushNotifications} />
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Auth Type" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <Badge variant="outline">{agent.authType}</Badge>
                </td>
              ))}
            </CompareRow>

            <CompareRow label="License">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4 text-text-secondary">
                  {agent.license !== "unknown" ? agent.license : "—"}
                </td>
              ))}
            </CompareRow>

            <CompareRow label="Official" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-4">
                  <BoolBadge value={agent.official} />
                </td>
              ))}
            </CompareRow>

            {/* Score Breakdown Section */}
            <tr>
              <td
                colSpan={agents.length + 1}
                className="border-t-2 border-border px-4 pt-5 pb-2"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Quality Score Breakdown
                </span>
              </td>
            </tr>

            {(
              [
                ["Stars", "stars"],
                ["Freshness", "freshness"],
                ["Official", "official"],
                ["Skill Maturity", "skillMaturity"],
                ["Protocol Compliance", "protocolCompliance"],
                ["Auth Security", "authSecurity"],
              ] as const
            ).map(([label, key], i) => (
              <CompareRow key={key} label={label} stripe={i % 2 === 1}>
                {breakdowns.map((b, j) => (
                  <td key={agents[j].slug} className="p-4">
                    <ScoreBar value={b[key]} />
                  </td>
                ))}
              </CompareRow>
            ))}
          </tbody>
        </table>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/compare"
          className="text-sm text-text-secondary hover:text-accent transition-colors"
        >
          &larr; All comparisons
        </Link>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  stripe,
  children,
}: {
  label: string;
  stripe?: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr className={`border-b border-border-subtle ${stripe ? "bg-surface/30" : ""}`}>
      <td className="p-4 text-sm font-medium text-text-secondary whitespace-nowrap">{label}</td>
      {children}
    </tr>
  );
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        value ? "text-emerald-600" : "text-stone-400"
      }`}
    >
      {value ? (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {value ? "Yes" : "No"}
    </span>
  );
}

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 70
      ? "bg-emerald-500"
      : value >= 50
        ? "bg-amber-500"
        : value >= 30
          ? "bg-orange-400"
          : "bg-stone-300";

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-text-secondary">{value}</span>
    </div>
  );
}
