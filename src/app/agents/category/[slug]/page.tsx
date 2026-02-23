import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgentCategories, getAgentsByCategory, CATEGORY_DISPLAY } from "@/lib/data";
import { AgentCard } from "@/components/agents/agent-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAgentCategories().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = CATEGORY_DISPLAY[slug];
  if (!meta) return {};
  const title = `Best A2A Agents for ${meta.label}`;
  const description = meta.description;
  return {
    title,
    description,
    alternates: { canonical: `https://stacka2a.dev/agents/category/${slug}` },
    openGraph: { title, description },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const meta = CATEGORY_DISPLAY[slug];
  if (!meta) notFound();

  const agents = getAgentsByCategory(slug);
  if (agents.length === 0) notFound();

  const allCategories = getAgentCategories().filter((c) => c !== slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${meta.label} A2A Agents`,
      description: meta.description,
      numberOfItems: agents.length,
      itemListElement: agents.map((agent, i) => ({
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
        { "@type": "ListItem", position: 2, name: "Agents", item: "https://stacka2a.dev/agents" },
        { "@type": "ListItem", position: 3, name: meta.label },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Breadcrumbs items={[
          { label: "Home", href: "/" },
          { label: "Agents", href: "/agents" },
          { label: meta.label },
        ]} />

        <div className="flex flex-col gap-2 mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Category</p>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            {meta.label}
          </h1>
          <p className="text-text-secondary">{meta.description}</p>
          <p className="text-sm text-text-tertiary">{agents.length} agents</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>

        {allCategories.length > 0 && (
          <div className="mt-16 border-t border-border pt-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Other categories</h2>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((cat) => (
                <Link
                  key={cat}
                  href={`/agents/category/${cat}`}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
                >
                  {CATEGORY_DISPLAY[cat]?.label || cat}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
