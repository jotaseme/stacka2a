import type { Metadata } from "next";
import { AgentCardValidatorTool } from "@/components/tools/agent-card-validator-tool";

export const metadata: Metadata = {
  title: "A2A Agent Card Validator — StackA2A",
  description:
    "Validate your A2A Agent Card JSON against the specification. Get errors, warnings, and best-practice suggestions.",
  alternates: {
    canonical: "https://stacka2a.dev/tools/agent-card-validator",
  },
};

export default function AgentCardValidatorPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary">
        Agent Card Validator
      </h1>
      <p className="mt-2 text-text-secondary">
        Validate your <code className="rounded bg-surface px-1.5 py-0.5 text-sm">agent-card.json</code> against the A2A protocol specification.
      </p>

      <div className="mt-8">
        <AgentCardValidatorTool />
      </div>
    </div>
  );
}
