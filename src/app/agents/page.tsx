import type { Metadata } from "next";
import { getAllAgents, getAgentCategories, getAgentFrameworks, getAgentLanguages } from "@/lib/data";
import { AgentList } from "@/components/agents/agent-list";

export const metadata: Metadata = {
  title: "A2A Agents Directory",
  description:
    "Browse 250+ A2A protocol agents with quality scores, capability badges, and connection code for Python, TypeScript, Java, Go, and C#.",
};

export default function AgentsPage() {
  const agents = getAllAgents();
  const categories = getAgentCategories();
  const frameworks = getAgentFrameworks();
  const languages = getAgentLanguages();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          A2A Agents
        </h1>
        <p className="text-text-secondary">
          Quality-scored A2A agents, auto-discovered from GitHub and registries.
        </p>
      </div>
      <AgentList
        agents={agents}
        categories={categories}
        frameworks={frameworks}
        languages={languages}
      />
    </div>
  );
}
