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
    { url: `${BASE_URL}/tools`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/tools/agent-card-validator`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/tools/agent-discovery`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/tools/sdk-playground`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
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

  // Compare pages: top agents per category
  const byCategory = new Map<string, typeof agents>();
  for (const agent of agents) {
    const list = byCategory.get(agent.category) || [];
    list.push(agent);
    byCategory.set(agent.category, list);
  }
  const comparePages: MetadataRoute.Sitemap = [];
  for (const [, categoryAgents] of byCategory) {
    const top = categoryAgents.slice(0, 5);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        comparePages.push({
          url: `${BASE_URL}/compare/${top[i].slug}-vs-${top[j].slug}`,
          lastModified: new Date(),
          changeFrequency: "monthly" as const,
          priority: 0.5,
        });
      }
    }
  }

  return [...staticPages, ...agentPages, ...stackPages, ...blogPages, ...comparePages.slice(0, 100)];
}
