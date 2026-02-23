import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "A2A Protocol Blog — Guides, Tutorials & Best Practices",
  description:
    "Technical guides, framework tutorials, and best practices for building with the A2A protocol. From beginner to production.",
  alternates: { canonical: "https://stacka2a.dev/blog" },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col gap-2 mb-12 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Insights
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Blog
        </h1>
        <p className="text-text-secondary">
          Guides, comparisons, and best practices for the A2A ecosystem.
        </p>
      </div>
      <div className="flex flex-col gap-5">
        {posts.map((post, i) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className={`card-hover group animate-fade-up stagger-${Math.min(i + 1, 6)} flex flex-col gap-2.5 rounded-2xl border border-border bg-surface-elevated p-6 transition-all hover:border-accent/30`}
          >
            <div className="flex items-center gap-3 text-xs text-text-tertiary">
              <time dateTime={post.date}>{post.date}</time>
              <span className="h-1 w-1 rounded-full bg-text-tertiary" />
              <span>{post.readingTime} min read</span>
            </div>
            <h2 className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors">
              {post.title}
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {post.description}
            </p>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {post.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border px-2 py-0.5 text-xs text-text-tertiary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="py-12 text-center text-text-secondary">
            No posts yet. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
