import Link from "next/link";
import type { BlogPost } from "@/lib/types";

interface RelatedPostsProps {
  currentSlug: string;
  currentTags: string[];
  allPosts: BlogPost[];
}

export function RelatedPosts({ currentSlug, currentTags, allPosts }: RelatedPostsProps) {
  const related = allPosts
    .filter((p) => p.slug !== currentSlug)
    .map((p) => ({
      post: p,
      shared: p.tags.filter((t) => currentTags.includes(t)).length,
    }))
    .filter((p) => p.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <div className="mt-12 border-t border-border pt-8">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Related posts</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {related.map(({ post }) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="card-hover group flex flex-col gap-2 rounded-2xl border border-border bg-surface-elevated p-5 transition-all hover:border-accent/30"
          >
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <time dateTime={post.date}>{post.date}</time>
              <span className="h-1 w-1 rounded-full bg-text-tertiary" />
              <span>{post.readingTime} min</span>
            </div>
            <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors leading-snug">
              {post.title}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
              {post.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
