import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { markdownToHtml } from "./markdown";

const LEARN_DIR = path.join(process.cwd(), "src/content/learn");

export interface LearnGuide {
  slug: string;
  title: string;
  description: string;
  readingTime: number;
  order: number;
  icon: string;
}

export function getAllLearnGuides(): LearnGuide[] {
  if (!fs.existsSync(LEARN_DIR)) return [];
  const files = fs.readdirSync(LEARN_DIR).filter((f) => f.endsWith(".md"));
  return files
    .map((f) => {
      const content = fs.readFileSync(path.join(LEARN_DIR, f), "utf-8");
      const { data } = matter(content);
      return {
        slug: f.replace(".md", ""),
        title: data.title,
        description: data.description,
        readingTime: data.readingTime || 15,
        order: data.order || 0,
        icon: data.icon || "book",
      } as LearnGuide;
    })
    .sort((a, b) => a.order - b.order);
}

export async function getLearnGuide(
  slug: string
): Promise<{ guide: LearnGuide; contentHtml: string } | null> {
  const filePath = path.join(LEARN_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  const contentHtml = await markdownToHtml(content);

  const guide: LearnGuide = {
    slug,
    title: data.title,
    description: data.description,
    readingTime: data.readingTime || 15,
    order: data.order || 0,
    icon: data.icon || "book",
  };

  return { guide, contentHtml };
}
