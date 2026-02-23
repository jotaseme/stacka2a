import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllAgents, getAgent, getStacksForAgent } from "@/lib/data";
import { AgentDetail } from "@/components/agents/agent-detail";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { fetchReadme } from "@/lib/github";
import { markdownToHtml } from "@/lib/markdown";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const agents = getAllAgents();
  return agents.map((agent) => ({ slug: agent.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) return {};
  return {
    title: `${agent.name} — A2A Agent`,
    description: agent.description,
    alternates: { canonical: `https://stacka2a.dev/agents/${slug}` },
  };
}

export default async function AgentPage({ params }: PageProps) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  const stacks = getStacksForAgent(slug);

  // Fetch README from GitHub (returns null on failure)
  const readmeMarkdown = await fetchReadme(agent.repository);
  const readmeHtml = readmeMarkdown
    ? await markdownToHtml(readmeMarkdown)
    : null;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: agent.name,
      description: agent.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      url: `https://stacka2a.dev/agents/${slug}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://stacka2a.dev" },
        { "@type": "ListItem", position: 2, name: "Agents", item: "https://stacka2a.dev/agents" },
        { "@type": "ListItem", position: 3, name: agent.name },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-6 pt-8">
        <Breadcrumbs items={[
          { label: "Home", href: "/" },
          { label: "Agents", href: "/agents" },
          { label: agent.name },
        ]} />
      </div>
      <AgentDetail agent={agent} stacks={stacks} readmeHtml={readmeHtml} />
    </>
  );
}
