import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPost, extractHeadings } from "@/lib/blog";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPost(slug);
  if (!result) return {};
  return {
    title: result.post.title,
    description: result.post.description,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPost(slug);
  if (!result) notFound();

  const { post, contentHtml } = result;
  const headings = extractHeadings(contentHtml);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    url: `https://stacka2a.dev/blog/${slug}`,
    publisher: {
      "@type": "Organization",
      name: "StackA2A",
      url: "https://stacka2a.dev",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-10">
          <Link
            href="/blog"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            &larr; Back to blog
          </Link>
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <time dateTime={post.date}>{post.date}</time>
            <span>&middot;</span>
            <span>{post.readingTime} min read</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            {post.title}
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            {post.description}
          </p>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Table of Contents */}
        {headings.length > 2 && (
          <nav className="mb-10 rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">
              Table of Contents
            </h2>
            <ul className="flex flex-col gap-1.5">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className="text-sm text-text-secondary hover:text-accent transition-colors"
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Content */}
        <div
          className="blog-prose prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {/* Related stacks */}
        {post.relatedStacks && post.relatedStacks.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Related Stacks
            </h2>
            <div className="flex flex-wrap gap-2">
              {post.relatedStacks.map((stackSlug) => (
                <Link
                  key={stackSlug}
                  href={`/stacks/${stackSlug}`}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
                >
                  {stackSlug}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </>
  );
}
