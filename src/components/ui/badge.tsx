import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "outline" | "accent";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-accent/10 text-accent",
        variant === "outline" && "border border-border text-text-secondary",
        variant === "accent" && "bg-accent text-white",
        className
      )}
    >
      {children}
    </span>
  );
}

interface DifficultyBadgeProps {
  difficulty: "beginner" | "intermediate" | "advanced";
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const colors = {
    beginner: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    intermediate: "bg-amber-50 text-amber-700 border border-amber-200",
    advanced: "bg-red-50 text-red-700 border border-red-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        colors[difficulty]
      )}
    >
      {difficulty}
    </span>
  );
}
