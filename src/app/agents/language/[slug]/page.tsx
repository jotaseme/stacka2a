import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgentLanguages, getAgentsByLanguage, LANGUAGE_DISPLAY } from "@/lib/data";
import { AgentCard } from "@/components/agents/agent-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAgentLanguages().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = LANGUAGE_DISPLAY[slug];
  if (!meta) return {};
  const title = `A2A Agents in ${meta.label}`;
  const description = meta.description;
  return {
    title,
    description,
    alternates: { canonical: `https://stacka2a.dev/agents/language/${slug}` },
    openGraph: { title, description },
  };
}

export default async function LanguagePage({ params }: PageProps) {
  const { slug } = await params;
  const meta = LANGUAGE_DISPLAY[slug];
  if (!meta) notFound();

  const agents = getAgentsByLanguage(slug);
  if (agents.length === 0) notFound();

  const allLanguages = getAgentLanguages().filter((l) => l !== slug);

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
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Language</p>
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

        {allLanguages.length > 0 && (
          <div className="mt-16 border-t border-border pt-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Other languages</h2>
            <div className="flex flex-wrap gap-2">
              {allLanguages.map((lang) => (
                <Link
                  key={lang}
                  href={`/agents/language/${lang}`}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
                >
                  {LANGUAGE_DISPLAY[lang]?.label || lang}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
