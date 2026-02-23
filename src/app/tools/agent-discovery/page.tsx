import type { Metadata } from "next";
import { AgentDiscoveryTool } from "@/components/tools/agent-discovery-tool";

export const metadata: Metadata = {
  title: "A2A Agent Discovery — StackA2A",
  description:
    "Enter an agent URL to fetch and inspect its Agent Card. See capabilities, skills, authentication, and metadata.",
  alternates: {
    canonical: "https://stacka2a.dev/tools/agent-discovery",
  },
};

export default function AgentDiscoveryPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary">
        Agent Discovery
      </h1>
      <p className="mt-2 text-text-secondary">
        Enter an agent URL to fetch its{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 text-sm">
          /.well-known/agent-card.json
        </code>{" "}
        and inspect its capabilities.
      </p>

      <div className="mt-8">
        <AgentDiscoveryTool />
      </div>
    </div>
  );
}
