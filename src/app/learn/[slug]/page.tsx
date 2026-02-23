import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllLearnGuides, getLearnGuide } from "@/lib/learn";
import { extractHeadings } from "@/lib/blog";
import { BlogToc } from "@/components/blog/blog-toc";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllLearnGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getLearnGuide(slug);
  if (!result) return {};
  return {
    title: result.guide.title,
    description: result.guide.description,
    alternates: { canonical: `https://stacka2a.dev/learn/${slug}` },
  };
}

export default async function LearnGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getLearnGuide(slug);
  if (!result) notFound();

  const { guide, contentHtml } = result;
  const headings = extractHeadings(contentHtml);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      url: `https://stacka2a.dev/learn/${slug}`,
      publisher: {
        "@type": "Organization",
        name: "StackA2A",
        url: "https://stacka2a.dev",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://stacka2a.dev" },
        { "@type": "ListItem", position: 2, name: "Learn", item: "https://stacka2a.dev/learn" },
        { "@type": "ListItem", position: 3, name: guide.title },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="xl:grid xl:grid-cols-[1fr_220px] xl:gap-12">
          <article className="max-w-3xl">
            <Breadcrumbs items={[
              { label: "Home", href: "/" },
              { label: "Learn", href: "/learn" },
              { label: guide.title },
            ]} />
            <div className="flex flex-col gap-4 mb-10">
              <span className="text-sm text-text-tertiary">
                {guide.readingTime} min read
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {guide.title}
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed">
                {guide.description}
              </p>
            </div>
            <div
              className="blog-prose prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </article>
          <BlogToc headings={headings} />
        </div>
      </div>
    </>
  );
}
