import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllStacks, getStackWithAgents } from "@/lib/data";
import { StackDetail } from "@/components/stacks/stack-detail";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const stacks = getAllStacks();
  return stacks.map((stack) => ({ slug: stack.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = getStackWithAgents(slug);
  if (!data) return {};
  return {
    title: data.stack.name,
    description: data.stack.description,
  };
}

export default async function StackPage({ params }: PageProps) {
  const { slug } = await params;
  const data = getStackWithAgents(slug);
  if (!data) notFound();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: data.stack.name,
      description: data.stack.description,
      numberOfItems: data.agents.length,
      itemListElement: data.agents.map((agent, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: agent.name,
        url: `https://stacka2a.dev/agents/${agent.slug}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://stacka2a.dev" },
        { "@type": "ListItem", position: 2, name: "Stacks", item: "https://stacka2a.dev/stacks" },
        { "@type": "ListItem", position: 3, name: data.stack.name },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StackDetail stack={data.stack} agents={data.agents} />
    </>
  );
}
