import Link from "next/link";
import type { Stack } from "@/lib/types";
import { DifficultyBadge } from "@/components/ui/badge";

interface StackCardProps {
  stack: Stack;
}

export function StackCard({ stack }: StackCardProps) {
  return (
    <Link
      href={`/stacks/${stack.slug}`}
      className="card-hover group flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-5 transition-all hover:border-accent/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/8 text-lg">
            {getStackEmoji(stack.icon)}
          </span>
          <div>
            <h3 className="font-semibold text-text-primary group-hover:text-accent transition-colors">
              {stack.name}
            </h3>
            <p className="text-xs text-text-tertiary">
              {stack.agents.length} agents
            </p>
          </div>
        </div>
        <DifficultyBadge difficulty={stack.difficulty} />
      </div>
      <p className="line-clamp-2 text-sm text-text-secondary leading-relaxed">
        {stack.description}
      </p>
    </Link>
  );
}

function getStackEmoji(icon: string): string {
  const emojiMap: Record<string, string> = {
    rocket: "\u{1F680}",
    code: "\u{1F4BB}",
    palette: "\u{1F3A8}",
    smartphone: "\u{1F4F1}",
    database: "\u{1F5C4}",
    cloud: "\u2601\uFE0F",
    shield: "\u{1F6E1}",
    "test-tube": "\u{1F9EA}",
    pen: "\u270F\uFE0F",
    users: "\u{1F465}",
    brain: "\u{1F9E0}",
    terminal: "\u{1F4DF}",
    globe: "\u{1F30D}",
    server: "\u{1F5A5}",
    zap: "\u26A1",
    wrench: "\u{1F527}",
    robot: "\u{1F916}",
    factory: "\u{1F3ED}",
    chart: "\u{1F4CA}",
    lock: "\u{1F512}",
  };
  return emojiMap[icon] || "\u{1F4E6}";
}
