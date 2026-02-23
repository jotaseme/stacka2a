import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { createOgImage, ogSize, ogContentType } from "@/lib/og-image";

export { ogSize as size, ogContentType as contentType };

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return createOgImage({ title: "Post Not Found" });
  }

  return createOgImage({
    title: post.title,
    subtitle: post.description,
    badge: `${post.readingTime} min read`,
  });
}
