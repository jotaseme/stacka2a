import { getAgent, getAllAgents } from "@/lib/data";
import { createOgImage, ogSize, ogContentType } from "@/lib/og-image";
import { computeQualityScore } from "@/lib/quality-score";

export { ogSize as size, ogContentType as contentType };

export function generateStaticParams() {
  return getAllAgents().map((a) => ({ slug: a.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) {
    return createOgImage({ title: "Agent Not Found" });
  }

  const score = computeQualityScore(agent);

  return createOgImage({
    title: agent.name,
    subtitle: agent.description.slice(0, 120),
    badge: `Score: ${score.total}/100 · ${agent.framework} · ${agent.language}`,
  });
}
