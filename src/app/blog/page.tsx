import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides, tutorials, and best practices for A2A protocol agents, frameworks, and multi-agent systems.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          Blog
        </h1>
        <p className="text-text-secondary">
          Guides, comparisons, and best practices for the A2A ecosystem.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col gap-2 rounded-2xl border border-border bg-background p-6 transition-all hover:border-accent/30 hover:shadow-sm"
          >
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <time dateTime={post.date}>{post.date}</time>
              <span>&middot;</span>
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
                    className="rounded-md border border-border px-2 py-0.5 text-xs text-text-secondary"
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
