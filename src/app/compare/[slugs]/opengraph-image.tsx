import { getAgent, getAllAgents } from "@/lib/data";
import { createOgImage, ogSize, ogContentType } from "@/lib/og-image";
import type { A2AAgent } from "@/lib/types";

export { ogSize as size, ogContentType as contentType };

export function generateStaticParams() {
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
  return params.slice(0, 100);
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slugs: string }>;
}) {
  const { slugs } = await params;
  const agentSlugs = slugs.split("-vs-").filter(Boolean);
  const agents = agentSlugs
    .map(getAgent)
    .filter((a): a is A2AAgent => a !== null);

  if (agents.length < 2) {
    return createOgImage({ title: "Agent Comparison" });
  }

  return createOgImage({
    title: agents.map((a) => a.name).join(" vs "),
    subtitle: "Side-by-side A2A agent comparison",
    badge: "Compare",
  });
}
