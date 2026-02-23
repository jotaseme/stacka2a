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
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary">
        Compare Agents
      </h1>
      <p className="mt-2 text-text-secondary">
        Side-by-side comparison of {agents.length} A2A agents
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3 text-left font-medium text-text-secondary">
                Property
              </th>
              {agents.map((agent) => (
                <th
                  key={agent.slug}
                  className="p-3 text-left font-medium text-text-primary"
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
            {/* Quality Score */}
            <CompareRow label="Quality Score">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <QualityScoreBadge agent={agent} size="sm" />
                </td>
              ))}
            </CompareRow>

            {/* Provider */}
            <CompareRow label="Provider" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3 text-text-primary">
                  {agent.provider.name}
                </td>
              ))}
            </CompareRow>

            {/* Framework */}
            <CompareRow label="Framework">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <Badge variant="outline">{agent.framework}</Badge>
                </td>
              ))}
            </CompareRow>

            {/* Language */}
            <CompareRow label="Language" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <Badge variant="outline">{agent.language}</Badge>
                </td>
              ))}
            </CompareRow>

            {/* Category */}
            <CompareRow label="Category">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <Badge variant="outline">{agent.category}</Badge>
                </td>
              ))}
            </CompareRow>

            {/* GitHub Stars */}
            <CompareRow label="GitHub Stars" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3 text-text-primary">
                  {agent.githubStars > 0
                    ? agent.githubStars.toLocaleString()
                    : "—"}
                </td>
              ))}
            </CompareRow>

            {/* Last Updated */}
            <CompareRow label="Last Updated">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3 text-text-secondary">
                  {agent.lastUpdated}
                </td>
              ))}
            </CompareRow>

            {/* Skills Count */}
            <CompareRow label="Skills" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3 text-text-primary">
                  {agent.skills.length}
                </td>
              ))}
            </CompareRow>

            {/* Streaming */}
            <CompareRow label="Streaming">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <BoolBadge value={agent.capabilities.streaming} />
                </td>
              ))}
            </CompareRow>

            {/* Multi-Turn */}
            <CompareRow label="Multi-Turn" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <BoolBadge value={agent.capabilities.multiTurn} />
                </td>
              ))}
            </CompareRow>

            {/* Push Notifications */}
            <CompareRow label="Push Notifications">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <BoolBadge value={agent.capabilities.pushNotifications} />
                </td>
              ))}
            </CompareRow>

            {/* Auth */}
            <CompareRow label="Auth Type" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <Badge variant="outline">{agent.authType}</Badge>
                </td>
              ))}
            </CompareRow>

            {/* License */}
            <CompareRow label="License">
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3 text-text-secondary">
                  {agent.license !== "unknown" ? agent.license : "—"}
                </td>
              ))}
            </CompareRow>

            {/* Official */}
            <CompareRow label="Official" stripe>
              {agents.map((agent) => (
                <td key={agent.slug} className="p-3">
                  <BoolBadge value={agent.official} />
                </td>
              ))}
            </CompareRow>

            {/* Quality Breakdown Header */}
            <tr className="border-t-2 border-border">
              <td
                colSpan={agents.length + 1}
                className="p-3 text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Quality Score Breakdown
              </td>
            </tr>

            {/* Score Breakdowns */}
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
                  <td key={agents[j].slug} className="p-3">
                    <ScoreBar value={b[key]} />
                  </td>
                ))}
              </CompareRow>
            ))}
          </tbody>
        </table>
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
    <tr className={stripe ? "bg-surface/50" : ""}>
      <td className="p-3 font-medium text-text-secondary">{label}</td>
      {children}
    </tr>
  );
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        value ? "text-emerald-600" : "text-zinc-400"
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
      ? "bg-green-500"
      : value >= 50
        ? "bg-yellow-500"
        : value >= 30
          ? "bg-orange-500"
          : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary">{value}</span>
    </div>
  );
}
