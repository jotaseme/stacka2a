import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import type { BlogPost } from "./types";

const BLOG_DIR = path.join(process.cwd(), "src/content/blog");

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  return files
    .map((f) => {
      const content = fs.readFileSync(path.join(BLOG_DIR, f), "utf-8");
      const { data } = matter(content);
      return {
        slug: f.replace(".md", ""),
        title: data.title,
        description: data.description,
        date: data.date,
        readingTime: data.readingTime || 5,
        tags: data.tags || [],
        relatedStacks: data.relatedStacks,
        relatedAgents: data.relatedAgents,
      } as BlogPost;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getPost(
  slug: string
): Promise<{ post: BlogPost; contentHtml: string } | null> {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  const processed = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeHighlight, { detect: true })
    .use(rehypeStringify)
    .process(content);
  const contentHtml = processed.toString();

  const post: BlogPost = {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    readingTime: data.readingTime || 5,
    tags: data.tags || [],
    relatedStacks: data.relatedStacks,
    relatedAgents: data.relatedAgents,
  };

  return { post, contentHtml };
}

export function getPostBySlug(slug: string): BlogPost | null {
  const posts = getAllPosts();
  return posts.find((p) => p.slug === slug) || null;
}

export function extractHeadings(html: string): { id: string; text: string }[] {
  const regex = /<h2[^>]*id="([^"]*)"[^>]*>(.*?)<\/h2>/gi;
  const headings: { id: string; text: string }[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({ id: match[1], text: match[2].replace(/<[^>]*>/g, "") });
  }
  return headings;
}
