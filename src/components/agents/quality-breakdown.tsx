import type { A2AAgent } from "@/lib/types";
import { computeQualityScore, getScoreLevel } from "@/lib/quality-score";

interface QualityBreakdownProps {
  agent: A2AAgent;
}

const DIMENSIONS = [
  { key: "stars" as const, label: "Community", icon: "★" },
  { key: "freshness" as const, label: "Freshness", icon: "◷" },
  { key: "official" as const, label: "Official", icon: "✓" },
  { key: "skillMaturity" as const, label: "Skills", icon: "⚡" },
  { key: "protocolCompliance" as const, label: "Protocol", icon: "⬡" },
  { key: "authSecurity" as const, label: "Security", icon: "🔒" },
];

const levelColors: Record<string, string> = {
  excellent: "bg-emerald-500",
  good: "bg-amber-500",
  fair: "bg-orange-500",
  poor: "bg-red-400",
};

const levelBarBg: Record<string, string> = {
  excellent: "bg-emerald-100",
  good: "bg-amber-100",
  fair: "bg-orange-100",
  poor: "bg-red-100",
};

export function QualityBreakdown({ agent }: QualityBreakdownProps) {
  const breakdown = computeQualityScore(agent);
  const totalLevel = getScoreLevel(breakdown.total);

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-5">
      {/* Total score */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <span className="text-sm font-medium text-text-secondary">
          Quality Score
        </span>
        <span
          className={`text-2xl font-bold tabular-nums ${
            totalLevel === "excellent"
              ? "text-emerald-600"
              : totalLevel === "good"
                ? "text-amber-600"
                : totalLevel === "fair"
                  ? "text-orange-500"
                  : "text-red-500"
          }`}
        >
          {breakdown.total}
          <span className="text-sm font-normal text-text-tertiary">/100</span>
        </span>
      </div>

      {/* Dimension bars */}
      <div className="flex flex-col gap-3">
        {DIMENSIONS.map(({ key, label, icon }) => {
          const value = breakdown[key];
          const level = getScoreLevel(value);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 text-xs text-text-secondary truncate">
                {icon} {label}
              </span>
              <div
                className={`flex-1 h-2 rounded-full ${levelBarBg[level]}`}
              >
                <div
                  className={`h-full rounded-full transition-all ${levelColors[level]}`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium tabular-nums text-text-secondary">
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
