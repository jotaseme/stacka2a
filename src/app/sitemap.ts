import type { MetadataRoute } from "next";
import { getAllStacks, getAllAgents } from "@/lib/data";
import { getAllPosts } from "@/lib/blog";

const BASE_URL = "https://stacka2a.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const stacks = getAllStacks();
  const agents = getAllAgents();
  const posts = getAllPosts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/agents`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/stacks`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];

  const agentPages: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${BASE_URL}/agents/${agent.slug}`,
    lastModified: new Date(agent.lastUpdated),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const stackPages: MetadataRoute.Sitemap = stacks.map((stack) => ({
    url: `${BASE_URL}/stacks/${stack.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...agentPages, ...stackPages, ...blogPages];
}
