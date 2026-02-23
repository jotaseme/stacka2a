# SEO Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ~24 category pages, fix canonicals, create /submit-agent, /learn, /faq, breadcrumbs, 20 blog posts, and related posts component to StackA2A.

**Architecture:** Static Next.js App Router pages with `generateStaticParams`. No backend — Formspree for submit form. All content in markdown files. Data layer functions in `src/lib/data.ts`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS 4, gray-matter + remark for markdown.

---

### Task 1: Fix Canonical URLs

**Files:**
- Modify: `src/app/agents/page.tsx`
- Modify: `src/app/agents/[slug]/page.tsx`
- Modify: `src/app/stacks/page.tsx`
- Modify: `src/app/stacks/[slug]/page.tsx`
- Modify: `src/app/blog/page.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`

**Step 1: Add canonical to /agents page**

In `src/app/agents/page.tsx`, change the metadata export:

```typescript
export const metadata: Metadata = {
  title: "A2A Agents Directory",
  description:
    "Browse 250+ A2A protocol agents with quality scores, capability badges, and connection code for Python, TypeScript, Java, Go, and C#.",
  alternates: { canonical: "https://stacka2a.dev/agents" },
};
```

**Step 2: Add canonical to /agents/[slug]**

In `src/app/agents/[slug]/page.tsx`, in `generateMetadata`, add alternates:

```typescript
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) return {};
  return {
    title: `${agent.name} — A2A Agent`,
    description: agent.description,
    alternates: { canonical: `https://stacka2a.dev/agents/${slug}` },
  };
}
```

**Step 3: Add canonical to /stacks page**

In `src/app/stacks/page.tsx`:

```typescript
export const metadata: Metadata = {
  title: "A2A Agent Stacks",
  description:
    "Browse curated stacks of A2A agents grouped by use case, framework, and industry.",
  alternates: { canonical: "https://stacka2a.dev/stacks" },
};
```

**Step 4: Add canonical to /stacks/[slug]**

In `src/app/stacks/[slug]/page.tsx`, in `generateMetadata`:

```typescript
return {
  title: data.stack.name,
  description: data.stack.description,
  alternates: { canonical: `https://stacka2a.dev/stacks/${slug}` },
};
```

**Step 5: Add canonical to /blog page**

In `src/app/blog/page.tsx`:

```typescript
export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides, tutorials, and best practices for A2A protocol agents, frameworks, and multi-agent systems.",
  alternates: { canonical: "https://stacka2a.dev/blog" },
};
```

**Step 6: Add canonical to /blog/[slug]**

In `src/app/blog/[slug]/page.tsx`, in `generateMetadata`:

```typescript
return {
  title: result.post.title,
  description: result.post.description,
  alternates: { canonical: `https://stacka2a.dev/blog/${slug}` },
};
```

**Step 7: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 8: Commit**

```bash
git add src/app/agents/page.tsx src/app/agents/\[slug\]/page.tsx src/app/stacks/page.tsx src/app/stacks/\[slug\]/page.tsx src/app/blog/page.tsx src/app/blog/\[slug\]/page.tsx
git commit -m "fix: add canonical URLs to agents, stacks, and blog pages"
```

---

### Task 2: Breadcrumbs UI Component

**Files:**
- Create: `src/components/ui/breadcrumbs.tsx`

**Step 1: Create breadcrumbs component**

```tsx
import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-text-tertiary">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-text-secondary"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-text-secondary">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

**Step 2: Add breadcrumbs to /agents/[slug]/page.tsx**

Import `Breadcrumbs` and render before `<AgentDetail>`:

```tsx
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
// ... in the return:
<Breadcrumbs items={[
  { label: "Home", href: "/" },
  { label: "Agents", href: "/agents" },
  { label: agent.name },
]} />
```

**Step 3: Add breadcrumbs to /stacks/[slug]/page.tsx**

Same pattern:

```tsx
<Breadcrumbs items={[
  { label: "Home", href: "/" },
  { label: "Stacks", href: "/stacks" },
  { label: data.stack.name },
]} />
```

**Step 4: Add breadcrumbs to /blog/[slug]/page.tsx**

Replace the existing `<- Back to blog` link with:

```tsx
<Breadcrumbs items={[
  { label: "Home", href: "/" },
  { label: "Blog", href: "/blog" },
  { label: post.title },
]} />
```

**Step 5: Add breadcrumbs to /compare/[slugs]/page.tsx**

```tsx
<Breadcrumbs items={[
  { label: "Home", href: "/" },
  { label: "Compare", href: "/compare" },
  { label: names.join(" vs ") },
]} />
```

**Step 6: Build and verify**

Run: `npm run build`

**Step 7: Commit**

```bash
git add src/components/ui/breadcrumbs.tsx src/app/agents/\[slug\]/page.tsx src/app/stacks/\[slug\]/page.tsx src/app/blog/\[slug\]/page.tsx src/app/compare/\[slugs\]/page.tsx
git commit -m "feat: add breadcrumbs UI to detail pages"
```

---

### Task 3: Data Layer for Category Pages + Display Names Map

**Files:**
- Modify: `src/lib/data.ts`

**Step 1: Add helper functions and display name maps**

Add to `src/lib/data.ts` after existing functions:

```typescript
export function getAgentsByFramework(framework: string): A2AAgent[] {
  return getAllAgents().filter((a) => a.framework === framework);
}

export function getAgentsByLanguage(language: string): A2AAgent[] {
  return getAllAgents().filter((a) => a.language === language);
}

export const CATEGORY_DISPLAY: Record<string, { label: string; description: string }> = {
  "code-generation": { label: "Code Generation", description: "A2A agents that write, review, and refactor code across languages and frameworks." },
  "data-analytics": { label: "Data & Analytics", description: "A2A agents for data processing, visualization, and analytical workflows." },
  enterprise: { label: "Enterprise & Workflow", description: "A2A agents for business processes: approvals, scheduling, task management." },
  infrastructure: { label: "Infrastructure", description: "A2A agents for cloud, containers, CI/CD, and infrastructure automation." },
  "multi-agent": { label: "Multi-Agent Systems", description: "A2A agents designed to coordinate and orchestrate other agents." },
  "image-media": { label: "Image & Media", description: "A2A agents for image generation, video processing, and media workflows." },
  "search-research": { label: "Search & Research", description: "A2A agents for web search, deep research, and information retrieval." },
  "security-auth": { label: "Security & Auth", description: "A2A agents for authentication, vulnerability scanning, and security automation." },
  utility: { label: "Utility", description: "General-purpose A2A agents: weather, email, notifications, and more." },
  finance: { label: "Finance", description: "A2A agents for payments, expense tracking, and financial workflows." },
  orchestration: { label: "Orchestration", description: "A2A agents that route, schedule, and manage task execution across systems." },
  "content-creation": { label: "Content Creation", description: "A2A agents for writing, editing, and publishing content." },
  communication: { label: "Communication", description: "A2A agents for messaging, notifications, and team collaboration." },
};

export const FRAMEWORK_DISPLAY: Record<string, { label: string; description: string }> = {
  "google-adk": { label: "Google ADK", description: "Agents built with Google's Agent Development Kit — the most mature A2A framework with built-in Agent Card generation and streaming." },
  langgraph: { label: "LangGraph", description: "Agents built with LangChain's LangGraph framework for stateful, multi-step agent workflows." },
  crewai: { label: "CrewAI", description: "Agents built with CrewAI for role-based multi-agent collaboration and task delegation." },
  "spring-boot": { label: "Spring Boot", description: "A2A agents for the Java/Kotlin ecosystem, built on Spring Boot for enterprise deployments." },
  autogen: { label: "AutoGen", description: "Agents built with Microsoft's AutoGen framework for multi-agent conversations and self-correcting loops." },
  custom: { label: "Custom Framework", description: "Agents built with custom or minimal frameworks, directly implementing the A2A protocol." },
};

export const LANGUAGE_DISPLAY: Record<string, { label: string; description: string }> = {
  python: { label: "Python", description: "A2A agents written in Python — the most popular language in the A2A ecosystem." },
  typescript: { label: "TypeScript", description: "A2A agents written in TypeScript for Node.js and Deno runtimes." },
  java: { label: "Java", description: "A2A agents written in Java, typically using Spring Boot for enterprise environments." },
  go: { label: "Go", description: "A2A agents written in Go for high-performance, low-footprint deployments." },
  csharp: { label: "C#", description: "A2A agents written in C# for the .NET ecosystem and Azure integration." },
};
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/lib/data.ts
git commit -m "feat: add display name maps and filter helpers for category pages"
```

---

### Task 4: Category Pages (by category, framework, language)

**Files:**
- Create: `src/app/agents/category/[slug]/page.tsx`
- Create: `src/app/agents/framework/[slug]/page.tsx`
- Create: `src/app/agents/language/[slug]/page.tsx`

**Step 1: Create category page**

Create `src/app/agents/category/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgentCategories, getAgentsByCategory, CATEGORY_DISPLAY } from "@/lib/data";
import { AgentCard } from "@/components/agents/agent-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAgentCategories().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = CATEGORY_DISPLAY[slug];
  if (!meta) return {};
  const title = `Best A2A Agents for ${meta.label}`;
  const description = meta.description;
  return {
    title,
    description,
    alternates: { canonical: `https://stacka2a.dev/agents/category/${slug}` },
    openGraph: { title, description },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const meta = CATEGORY_DISPLAY[slug];
  if (!meta) notFound();

  const agents = getAgentsByCategory(slug);
  if (agents.length === 0) notFound();

  const allCategories = getAgentCategories().filter((c) => c !== slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${meta.label} A2A Agents`,
      description: meta.description,
      numberOfItems: agents.length,
      itemListElement: agents.map((agent, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: agent.name,
        url: `https://stacka2a.dev/agents/${agent.slug}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://stacka2a.dev" },
        { "@type": "ListItem", position: 2, name: "Agents", item: "https://stacka2a.dev/agents" },
        { "@type": "ListItem", position: 3, name: meta.label },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Breadcrumbs items={[
          { label: "Home", href: "/" },
          { label: "Agents", href: "/agents" },
          { label: meta.label },
        ]} />

        <div className="flex flex-col gap-2 mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Category</p>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            {meta.label}
          </h1>
          <p className="text-text-secondary">{meta.description}</p>
          <p className="text-sm text-text-tertiary">{agents.length} agents</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>

        {allCategories.length > 0 && (
          <div className="mt-16 border-t border-border pt-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Other categories</h2>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((cat) => (
                <Link
                  key={cat}
                  href={`/agents/category/${cat}`}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
                >
                  {CATEGORY_DISPLAY[cat]?.label || cat}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

**Step 2: Create framework page**

Create `src/app/agents/framework/[slug]/page.tsx` — same pattern as category but using `getAgentFrameworks`, `getAgentsByFramework`, and `FRAMEWORK_DISPLAY`. Change breadcrumb to show "Framework" and heading subtitle to "Framework". Link to other frameworks at bottom.

**Step 3: Create language page**

Create `src/app/agents/language/[slug]/page.tsx` — same pattern using `getAgentLanguages`, `getAgentsByLanguage`, and `LANGUAGE_DISPLAY`.

**Step 4: Build and verify**

Run: `npm run build`
Expected: Build generates ~24 new static pages.

**Step 5: Commit**

```bash
git add src/app/agents/category src/app/agents/framework src/app/agents/language
git commit -m "feat: add static category, framework, and language pages for agents"
```

---

### Task 5: Update Sitemap + Navigation

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/footer.tsx`

**Step 1: Add category/framework/language pages to sitemap**

In `src/app/sitemap.ts`, import `getAgentCategories, getAgentFrameworks, getAgentLanguages` from data. Add after `staticPages`:

```typescript
const categoryPages: MetadataRoute.Sitemap = getAgentCategories().map((cat) => ({
  url: `${BASE_URL}/agents/category/${cat}`,
  lastModified: new Date(),
  changeFrequency: "weekly" as const,
  priority: 0.8,
}));

const frameworkPages: MetadataRoute.Sitemap = getAgentFrameworks().map((fw) => ({
  url: `${BASE_URL}/agents/framework/${fw}`,
  lastModified: new Date(),
  changeFrequency: "weekly" as const,
  priority: 0.8,
}));

const languagePages: MetadataRoute.Sitemap = getAgentLanguages().map((lang) => ({
  url: `${BASE_URL}/agents/language/${lang}`,
  lastModified: new Date(),
  changeFrequency: "weekly" as const,
  priority: 0.8,
}));
```

Add new static pages for /learn, /faq, /submit-agent to `staticPages` array:

```typescript
{ url: `${BASE_URL}/learn`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
{ url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
{ url: `${BASE_URL}/submit-agent`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
```

Spread the new arrays into the return.

Also import `getAllLearnGuides` (created in Task 7) and add learn pages to sitemap.

**Step 2: Add "Learn" to header navigation**

In `src/components/layout/header.tsx`, add to `navItems` between Tools and Blog:

```typescript
const navItems = [
  { href: "/stacks", label: "Stacks" },
  { href: "/agents", label: "Agents" },
  { href: "/compare", label: "Compare" },
  { href: "/tools", label: "Tools" },
  { href: "/learn", label: "Learn" },
  { href: "/blog", label: "Blog" },
];
```

**Step 3: Add "Submit Agent" and "FAQ" to footer**

In `src/components/layout/footer.tsx`, add to `footerLinks`:

```typescript
const footerLinks = [
  { href: "/stacks", label: "Stacks" },
  { href: "/agents", label: "Agents" },
  { href: "/compare", label: "Compare" },
  { href: "/tools", label: "Tools" },
  { href: "/learn", label: "Learn" },
  { href: "/blog", label: "Blog" },
  { href: "/submit-agent", label: "Submit Agent" },
  { href: "/faq", label: "FAQ" },
];
```

**Step 4: Commit**

```bash
git add src/app/sitemap.ts src/components/layout/header.tsx src/components/layout/footer.tsx
git commit -m "feat: update sitemap and navigation for new pages"
```

---

### Task 6: Related Posts Component

**Files:**
- Create: `src/components/blog/related-posts.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`

**Step 1: Create related posts component**

```tsx
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
```

**Step 2: Integrate into blog post page**

In `src/app/blog/[slug]/page.tsx`, import `getAllPosts` from `@/lib/blog` and `RelatedPosts` from `@/components/blog/related-posts`.

After the "Related stacks" section (around line 115), add:

```tsx
<RelatedPosts
  currentSlug={slug}
  currentTags={post.tags}
  allPosts={getAllPosts()}
/>
```

**Step 3: Build and verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/blog/related-posts.tsx src/app/blog/\[slug\]/page.tsx
git commit -m "feat: add related posts component to blog"
```

---

### Task 7: /learn Section (Data Layer + Pages)

**Files:**
- Create: `src/lib/learn.ts`
- Create: `src/app/learn/page.tsx`
- Create: `src/app/learn/[slug]/page.tsx`

**Step 1: Create learn data layer**

Create `src/lib/learn.ts` — mirror of `src/lib/blog.ts` but reading from `src/content/learn/`:

```typescript
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

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

  const processed = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeHighlight, { detect: true })
    .use(rehypeStringify)
    .process(content);

  const guide: LearnGuide = {
    slug,
    title: data.title,
    description: data.description,
    readingTime: data.readingTime || 15,
    order: data.order || 0,
    icon: data.icon || "book",
  };

  return { guide, contentHtml: processed.toString() };
}
```

**Step 2: Create learn index page**

Create `src/app/learn/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getAllLearnGuides } from "@/lib/learn";

export const metadata: Metadata = {
  title: "Learn A2A Protocol",
  description: "Comprehensive guides to the A2A protocol: fundamentals, Agent Cards, SDKs, and security. From zero to production.",
  alternates: { canonical: "https://stacka2a.dev/learn" },
};

const ICONS: Record<string, () => JSX.Element> = {
  book: BookIcon,
  card: CardIcon,
  code: CodeIcon,
  shield: ShieldIcon,
};

export default function LearnPage() {
  const guides = getAllLearnGuides();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-12 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Guides</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Learn A2A
        </h1>
        <p className="mt-2 text-text-secondary">
          Everything you need to understand and build with the A2A protocol.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map((guide, i) => {
          const Icon = ICONS[guide.icon] || ICONS.book;
          return (
            <Link
              key={guide.slug}
              href={`/learn/${guide.slug}`}
              className={`card-hover group animate-fade-up stagger-${i + 1} flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-6 transition-all hover:border-accent/30`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Icon />
              </span>
              <h2 className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors">
                {guide.title}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                {guide.description}
              </p>
              <span className="text-xs text-text-tertiary">{guide.readingTime} min read</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function BookIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" /></svg>;
}
function CardIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="5" rx="2" /><path d="M3 10h18" /></svg>;
}
function CodeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
}
function ShieldIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>;
}
```

**Step 3: Create learn detail page**

Create `src/app/learn/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllLearnGuides, getLearnGuide } from "@/lib/learn";
import { extractHeadings } from "@/lib/blog";
import { BlogToc } from "@/components/blog/blog-toc";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllLearnGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getLearnGuide(slug);
  if (!result) return {};
  return {
    title: result.guide.title,
    description: result.guide.description,
    alternates: { canonical: `https://stacka2a.dev/learn/${slug}` },
  };
}

export default async function LearnGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getLearnGuide(slug);
  if (!result) notFound();

  const { guide, contentHtml } = result;
  const headings = extractHeadings(contentHtml);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      url: `https://stacka2a.dev/learn/${slug}`,
      publisher: { "@type": "Organization", name: "StackA2A", url: "https://stacka2a.dev" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://stacka2a.dev" },
        { "@type": "ListItem", position: 2, name: "Learn", item: "https://stacka2a.dev/learn" },
        { "@type": "ListItem", position: 3, name: guide.title },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="xl:grid xl:grid-cols-[1fr_220px] xl:gap-12">
          <article className="max-w-3xl">
            <Breadcrumbs items={[
              { label: "Home", href: "/" },
              { label: "Learn", href: "/learn" },
              { label: guide.title },
            ]} />
            <div className="flex flex-col gap-4 mb-10">
              <span className="text-sm text-text-tertiary">{guide.readingTime} min read</span>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {guide.title}
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed">{guide.description}</p>
            </div>
            <div className="blog-prose prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </article>
          <BlogToc headings={headings} />
        </div>
      </div>
    </>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/learn.ts src/app/learn
git commit -m "feat: add /learn section with data layer and pages"
```

---

### Task 8: /submit-agent Page

**Files:**
- Create: `src/app/submit-agent/page.tsx`

**Step 1: Create submit agent page**

Create `src/app/submit-agent/page.tsx` with a Formspree form. Use `CATEGORY_DISPLAY`, `FRAMEWORK_DISPLAY`, `LANGUAGE_DISPLAY` for select options. Style with existing Tailwind design tokens. Include breadcrumbs. Canonical URL. Show success message when `?submitted=true` query param is present.

The form should use `action="https://formspree.io/f/YOUR_FORM_ID"` as a placeholder and `method="POST"`. Style all inputs consistently with the existing design system (border-border, bg-surface-elevated, rounded-xl, etc.).

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/submit-agent
git commit -m "feat: add /submit-agent page with Formspree form"
```

---

### Task 9: FAQ Page with FAQPage Schema

**Files:**
- Create: `src/app/faq/page.tsx`

**Step 1: Create FAQ page**

Create `src/app/faq/page.tsx` with ~15 questions in 3 sections. Each question is an accordion (details/summary HTML). FAQPage JSON-LD schema with all questions. Breadcrumbs. Canonical URL.

Questions should be real, useful answers — not marketing copy. Link to relevant pages (/agents, /learn, /blog, /submit-agent) from answers.

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/faq
git commit -m "feat: add FAQ page with FAQPage schema markup"
```

---

### Task 10: Write 4 Learn Guides

**Files:**
- Create: `src/content/learn/what-is-a2a.md`
- Create: `src/content/learn/agent-card-spec.md`
- Create: `src/content/learn/sdks-by-language.md`
- Create: `src/content/learn/security-guide.md`

Each guide should be 3000+ words of pillar content. Frontmatter format:

```yaml
---
title: "..."
description: "..."
readingTime: 15
order: 1
icon: "book"
---
```

Write in the same voice as existing blog posts: direct, opinionated, working code, no filler. These are reference guides, not blog posts — they should be comprehensive and organized for scanning.

**Commit after each guide or all together:**

```bash
git add src/content/learn
git commit -m "feat: add 4 pillar learn guides"
```

---

### Task 11: Write 20 Blog Posts (Batch 1: Posts 1-10)

**Files:**
- Create 10 markdown files in `src/content/blog/`

Posts 1-10:
1. `a2a-protocol-tutorial-beginners.md`
2. `a2a-python-sdk-guide.md`
3. `a2a-typescript-sdk-guide.md`
4. `deploy-a2a-agent-production.md`
5. `a2a-agent-card-json-schema.md`
6. `a2a-streaming-protocol-guide.md`
7. `a2a-multi-turn-conversations.md`
8. `a2a-vs-rest-api.md`
9. `a2a-vs-grpc-comparison.md`
10. `a2a-vs-autogen.md`

Each 200-400 lines. Frontmatter: title, description, date (stagger dates from 2026-02-23 onward), readingTime, tags, relatedStacks, relatedAgents.

Write in the same voice as existing posts. Working code examples. No filler. Direct and opinionated.

**Commit:**

```bash
git add src/content/blog/a2a-protocol-tutorial-beginners.md src/content/blog/a2a-python-sdk-guide.md src/content/blog/a2a-typescript-sdk-guide.md src/content/blog/deploy-a2a-agent-production.md src/content/blog/a2a-agent-card-json-schema.md src/content/blog/a2a-streaming-protocol-guide.md src/content/blog/a2a-multi-turn-conversations.md src/content/blog/a2a-vs-rest-api.md src/content/blog/a2a-vs-grpc-comparison.md src/content/blog/a2a-vs-autogen.md
git commit -m "feat: add 10 blog posts (batch 1)"
```

---

### Task 12: Write 20 Blog Posts (Batch 2: Posts 11-20)

**Files:**
- Create 10 markdown files in `src/content/blog/`

Posts 11-20:
11. `multi-agent-system-a2a.md`
12. `a2a-agent-authentication-guide.md`
13. `google-adk-tutorial-2026.md`
14. `a2a-agent-testing-debugging.md`
15. `a2a-error-handling-patterns.md`
16. `a2a-agent-monitoring-observability.md`
17. `best-a2a-agents-content-creation.md`
18. `best-a2a-agents-security.md`
19. `a2a-crewai-vs-langgraph.md`
20. `a2a-protocol-roadmap-2026.md`

Same guidelines as batch 1.

**Commit:**

```bash
git add src/content/blog/multi-agent-system-a2a.md src/content/blog/a2a-agent-authentication-guide.md src/content/blog/google-adk-tutorial-2026.md src/content/blog/a2a-agent-testing-debugging.md src/content/blog/a2a-error-handling-patterns.md src/content/blog/a2a-agent-monitoring-observability.md src/content/blog/best-a2a-agents-content-creation.md src/content/blog/best-a2a-agents-security.md src/content/blog/a2a-crewai-vs-langgraph.md src/content/blog/a2a-protocol-roadmap-2026.md
git commit -m "feat: add 10 blog posts (batch 2)"
```

---

### Task 13: Final Build + Verify

**Step 1: Full build**

Run: `npm run build`

Expected: All ~350+ pages build successfully.

**Step 2: Verify page count**

Check build output for total pages generated. Should include:
- 256 agent pages + ~24 category pages + 12 stack pages + 32 blog pages + 4 learn pages + ~100 compare pages + static pages = ~440+ pages

**Step 3: Spot-check pages**

Run: `npm run dev`

Verify manually:
- `/agents/category/code-generation` shows filtered agents with breadcrumbs
- `/agents/framework/google-adk` shows ADK agents
- `/learn` shows 4 guide cards
- `/learn/what-is-a2a` shows full guide with TOC
- `/submit-agent` shows form
- `/faq` shows accordion questions
- Any blog post shows related posts at bottom
- Breadcrumbs appear on all detail pages

**Step 4: Final commit if any fixes needed**
