import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllAgents, getAgent } from "@/lib/data";
import { AgentComparison } from "@/components/agents/agent-comparison";
import type { A2AAgent } from "@/lib/types";

interface PageProps {
  params: Promise<{ slugs: string }>;
}

export async function generateStaticParams() {
  // Generate comparisons for agents within the same category
  const agents = getAllAgents();
  const byCategory = new Map<string, A2AAgent[]>();
  for (const agent of agents) {
    const list = byCategory.get(agent.category) || [];
    list.push(agent);
    byCategory.set(agent.category, list);
  }

  const params: { slugs: string }[] = [];
  for (const [, categoryAgents] of byCategory) {
    const top = categoryAgents.slice(0, 5);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        params.push({ slugs: `${top[i].slug}-vs-${top[j].slug}` });
      }
    }
  }

  return params.slice(0, 100); // Cap at 100 comparison pages
}

function parseSlugs(slugsParam: string): string[] {
  return slugsParam.split("-vs-").filter(Boolean);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slugs } = await params;
  const agentSlugs = parseSlugs(slugs);
  const agents = agentSlugs.map(getAgent).filter((a): a is A2AAgent => a !== null);

  if (agents.length < 2) return {};

  const names = agents.map((a) => a.name);
  const title = `${names.join(" vs ")} — A2A Agent Comparison`;
  const description = `Compare ${names.join(" and ")} side-by-side: quality scores, capabilities, frameworks, and more.`;

  return {
    title,
    description,
    alternates: { canonical: `https://stacka2a.dev/compare/${slugs}` },
    openGraph: {
      title,
      description,
      url: `https://stacka2a.dev/compare/${slugs}`,
      type: "website",
    },
  };
}

export default async function ComparePage({ params }: PageProps) {
  const { slugs } = await params;
  const agentSlugs = parseSlugs(slugs);
  const agents = agentSlugs.map(getAgent).filter((a): a is A2AAgent => a !== null);

  if (agents.length < 2) notFound();

  return (
    <>
      <AgentComparison agents={agents} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: "https://stacka2a.dev",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Compare",
                item: `https://stacka2a.dev/compare/${slugs}`,
              },
            ],
          }),
        }}
      />
    </>
  );
}
