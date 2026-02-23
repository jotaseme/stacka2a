import { getStack, getAllStacks } from "@/lib/data";
import { createOgImage, ogSize, ogContentType } from "@/lib/og-image";

export { ogSize as size, ogContentType as contentType };

export function generateStaticParams() {
  return getAllStacks().map((s) => ({ slug: s.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const stack = getStack(slug);
  if (!stack) {
    return createOgImage({ title: "Stack Not Found" });
  }

  return createOgImage({
    title: stack.name,
    subtitle: stack.description.slice(0, 120),
    badge: `${stack.agents.length} agents · ${stack.difficulty}`,
  });
}
