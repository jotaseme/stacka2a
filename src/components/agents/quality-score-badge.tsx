import type { A2AAgent } from "@/lib/types";
import { computeQualityScore } from "@/lib/quality-score";
import { cn } from "@/lib/utils";

interface QualityScoreBadgeProps {
  agent: A2AAgent;
  size?: "sm" | "lg";
}

export function QualityScoreBadge({ agent, size = "sm" }: QualityScoreBadgeProps) {
  const { total } = computeQualityScore(agent);
  const rounded = Math.round(total);

  const color =
    rounded >= 70
      ? "bg-emerald-50 text-emerald-700"
      : rounded >= 40
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold tabular-nums",
        size === "sm" && "rounded-md px-1.5 py-0.5 text-xs",
        size === "lg" && "rounded-lg px-2.5 py-1 text-sm",
        color
      )}
      title={`Quality score: ${rounded}/100`}
    >
      {rounded}
    </span>
  );
}
