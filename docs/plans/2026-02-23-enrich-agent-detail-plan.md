# Enrich Agent Detail Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the useless agent detail page content (generic Quick Connect) with three useful sections: Quality Score Breakdown, Getting Started, and GitHub README.

**Architecture:** Static generation at build time. GitHub README fetched via API during `next build`, rendered with the same remark/rehype pipeline as blog posts. All new sections are server components — no client JS added. Graceful degradation when GitHub data is unavailable.

**Tech Stack:** Next.js 16 (App Router, SSG), TypeScript, Tailwind CSS 4, remark/rehype (already installed), GitHub REST API, vitest.

---

### Task 1: Create `src/lib/github.ts` — URL parser and README fetcher

**Files:**
- Create: `src/lib/github.ts`
- Test: `src/lib/__tests__/github.test.ts`

**Step 1: Write tests for `parseRepoUrl`**

```typescript
// src/lib/__tests__/github.test.ts
import { describe, it, expect } from "vitest";
import { parseRepoUrl } from "../github";

describe("parseRepoUrl", () => {
  it("parses standalone repo URL", () => {
    expect(parseRepoUrl("https://github.com/user/repo")).toEqual({
      owner: "user",
      repo: "repo",
      path: null,
      branch: "main",
    });
  });

  it("parses monorepo URL with path", () => {
    expect(
      parseRepoUrl(
        "https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/adk_facts"
      )
    ).toEqual({
      owner: "a2aproject",
      repo: "a2a-samples",
      path: "samples/python/agents/adk_facts",
      branch: "main",
    });
  });

  it("strips trailing slash", () => {
    expect(parseRepoUrl("https://github.com/user/repo/")).toEqual({
      owner: "user",
      repo: "repo",
      path: null,
      branch: "main",
    });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseRepoUrl("https://gitlab.com/user/repo")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRepoUrl("")).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/github.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `parseRepoUrl` and `fetchReadme`**

```typescript
// src/lib/github.ts
export interface ParsedRepo {
  owner: string;
  repo: string;
  path: string | null;
  branch: string;
}

export function parseRepoUrl(url: string): ParsedRepo | null {
  if (!url) return null;
  const cleaned = url.replace(/\/$/, "");
  const match = cleaned.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+)\/(.+))?$/
  );
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    path: match[4] || null,
    branch: match[3] || "main",
  };
}

export async function fetchReadme(repoUrl: string): Promise<string | null> {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) return null;

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "stacka2a-build",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Try subdirectory README first for monorepos, then root
  const urls = parsed.path
    ? [
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${parsed.path}/README.md?ref=${parsed.branch}`,
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/readme`,
      ]
    : [`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/readme`];

  for (const apiUrl of urls) {
    try {
      const res = await fetch(apiUrl, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.content && data.encoding === "base64") {
        return Buffer.from(data.content, "base64").toString("utf-8");
      }
    } catch {
      continue;
    }
  }
  return null;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/github.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/github.ts src/lib/__tests__/github.test.ts
git commit -m "feat: add GitHub URL parser and README fetcher"
```

---

### Task 2: Extract `markdownToHtml` from blog pipeline

**Files:**
- Modify: `src/lib/blog.ts` (lines 44-50 — the remark pipeline)
- Create: `src/lib/markdown.ts`
- Test: `src/lib/__tests__/markdown.test.ts`

**Step 1: Write test for `markdownToHtml`**

```typescript
// src/lib/__tests__/markdown.test.ts
import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdown";

describe("markdownToHtml", () => {
  it("renders basic markdown", async () => {
    const html = await markdownToHtml("# Hello\n\nWorld");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
    expect(html).toContain("<p>World</p>");
  });

  it("renders GFM tables", async () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const html = await markdownToHtml(md);
    expect(html).toContain("<table>");
  });

  it("renders code blocks with highlight", async () => {
    const md = "```python\nprint('hi')\n```";
    const html = await markdownToHtml(md);
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
  });

  it("returns empty string for empty input", async () => {
    const html = await markdownToHtml("");
    expect(html).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/markdown.test.ts`
Expected: FAIL — module not found

**Step 3: Create `markdown.ts` and refactor `blog.ts`**

```typescript
// src/lib/markdown.ts
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

export async function markdownToHtml(md: string): Promise<string> {
  if (!md) return "";
  const result = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeHighlight, { detect: true })
    .use(rehypeStringify)
    .process(md);
  return result.toString();
}
```

Then update `src/lib/blog.ts` to import and use `markdownToHtml` instead of duplicating the pipeline:

Replace lines 1-9 imports:
```typescript
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { markdownToHtml } from "./markdown";
import type { BlogPost } from "./types";
```

Replace lines 43-50 (the remark pipeline in `getPost`) with:
```typescript
  const contentHtml = await markdownToHtml(content);
```

Remove the remark/rehype imports that are no longer needed from blog.ts (lines 4-9):
- `remark`, `remarkGfm`, `remarkRehype`, `rehypeSlug`, `rehypeHighlight`, `rehypeStringify`

**Step 4: Run tests**

Run: `npx vitest run src/lib/__tests__/markdown.test.ts`
Expected: PASS

**Step 5: Verify blog still builds**

Run: `npx next build 2>&1 | head -30`
Expected: Build starts without import errors

**Step 6: Commit**

```bash
git add src/lib/markdown.ts src/lib/__tests__/markdown.test.ts src/lib/blog.ts
git commit -m "refactor: extract markdownToHtml from blog pipeline"
```

---

### Task 3: Create `src/lib/getting-started.ts`

**Files:**
- Create: `src/lib/getting-started.ts`
- Test: `src/lib/__tests__/getting-started.test.ts`

**Step 1: Write tests**

```typescript
// src/lib/__tests__/getting-started.test.ts
import { describe, it, expect } from "vitest";
import { generateGettingStarted } from "../getting-started";

const makeAgent = (overrides: Record<string, unknown> = {}) => ({
  slug: "test",
  name: "Test Agent",
  repository: "https://github.com/user/repo",
  language: "python",
  framework: "custom",
  endpointUrl: undefined,
  ...overrides,
});

describe("generateGettingStarted", () => {
  it("generates python steps", () => {
    const steps = generateGettingStarted(makeAgent() as any);
    expect(steps.clone).toBe("git clone https://github.com/user/repo");
    expect(steps.install).toContain("pip");
    expect(steps.navigate).toBe("cd repo");
  });

  it("generates typescript steps", () => {
    const steps = generateGettingStarted(
      makeAgent({ language: "typescript" }) as any
    );
    expect(steps.install).toContain("npm");
  });

  it("generates java steps", () => {
    const steps = generateGettingStarted(
      makeAgent({ language: "java" }) as any
    );
    expect(steps.install).toContain("mvn");
  });

  it("generates go steps", () => {
    const steps = generateGettingStarted(makeAgent({ language: "go" }) as any);
    expect(steps.install).toContain("go mod");
  });

  it("generates csharp steps", () => {
    const steps = generateGettingStarted(
      makeAgent({ language: "csharp" }) as any
    );
    expect(steps.install).toContain("dotnet");
  });

  it("handles monorepo paths", () => {
    const steps = generateGettingStarted(
      makeAgent({
        repository:
          "https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/adk",
      }) as any
    );
    expect(steps.clone).toBe(
      "git clone https://github.com/a2aproject/a2a-samples"
    );
    expect(steps.navigate).toBe(
      "cd a2a-samples/samples/python/agents/adk"
    );
  });

  it("includes endpointUrl when present", () => {
    const steps = generateGettingStarted(
      makeAgent({ endpointUrl: "https://example.com" }) as any
    );
    expect(steps.hostedEndpoint).toBe("https://example.com");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/getting-started.test.ts`
Expected: FAIL

**Step 3: Implement**

```typescript
// src/lib/getting-started.ts
import type { A2AAgent } from "./types";
import { parseRepoUrl } from "./github";

export interface GettingStartedSteps {
  clone: string;
  navigate: string;
  install: string;
  run: string;
  hostedEndpoint: string | null;
}

export function generateGettingStarted(agent: A2AAgent): GettingStartedSteps {
  const parsed = parseRepoUrl(agent.repository);
  const repoName = parsed?.repo || "repo";

  const cloneUrl = parsed?.path
    ? `https://github.com/${parsed.owner}/${parsed.repo}`
    : agent.repository;

  const navigate = parsed?.path
    ? `cd ${repoName}/${parsed.path}`
    : `cd ${repoName}`;

  return {
    clone: `git clone ${cloneUrl}`,
    navigate,
    install: getInstallCommand(agent.language),
    run: getRunCommand(agent.language, agent.framework),
    hostedEndpoint: agent.endpointUrl || null,
  };
}

function getInstallCommand(language: string): string {
  switch (language) {
    case "python":
      return "pip install -r requirements.txt";
    case "typescript":
    case "javascript":
      return "npm install";
    case "java":
      return "mvn install";
    case "go":
      return "go mod download";
    case "csharp":
      return "dotnet restore";
    case "rust":
      return "cargo build";
    default:
      return "# Check README for install instructions";
  }
}

function getRunCommand(language: string, framework: string): string {
  // Framework-specific run commands
  const frameworkCommands: Record<string, string> = {
    "spring-boot": "mvn spring-boot:run",
    django: "python manage.py runserver",
    fastapi: "uvicorn main:app --reload",
    flask: "python app.py",
  };
  if (frameworkCommands[framework]) return frameworkCommands[framework];

  // Language-generic fallbacks
  switch (language) {
    case "python":
      return "python main.py";
    case "typescript":
    case "javascript":
      return "npm start";
    case "java":
      return "mvn exec:java";
    case "go":
      return "go run .";
    case "csharp":
      return "dotnet run";
    case "rust":
      return "cargo run";
    default:
      return "# Check README for run instructions";
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/__tests__/getting-started.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/getting-started.ts src/lib/__tests__/getting-started.test.ts
git commit -m "feat: add getting-started step generator"
```

---

### Task 4: Create `src/components/agents/quality-breakdown.tsx`

**Files:**
- Create: `src/components/agents/quality-breakdown.tsx`

**Step 1: Create the component**

This is a server component — no "use client" needed. Uses `computeQualityScore` which already exists.

```tsx
// src/components/agents/quality-breakdown.tsx
import type { A2AAgent } from "@/lib/types";
import { computeQualityScore, getScoreLevel } from "@/lib/quality-score";

interface QualityBreakdownProps {
  agent: A2AAgent;
}

const DIMENSIONS = [
  { key: "stars" as const, label: "Community", icon: "★" },
  { key: "freshness" as const, label: "Freshness", icon: "◷" },
  { key: "official" as const, label: "Official", icon: "✓" },
  { key: "skillMaturity" as const, label: "Skills", icon: "⚡" },
  { key: "protocolCompliance" as const, label: "Protocol", icon: "⬡" },
  { key: "authSecurity" as const, label: "Security", icon: "🔒" },
];

const levelColors: Record<string, string> = {
  excellent: "bg-emerald-500",
  good: "bg-amber-500",
  fair: "bg-orange-500",
  poor: "bg-red-400",
};

const levelBarBg: Record<string, string> = {
  excellent: "bg-emerald-100",
  good: "bg-amber-100",
  fair: "bg-orange-100",
  poor: "bg-red-100",
};

export function QualityBreakdown({ agent }: QualityBreakdownProps) {
  const breakdown = computeQualityScore(agent);
  const totalLevel = getScoreLevel(breakdown.total);

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-5">
      {/* Total score */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <span className="text-sm font-medium text-text-secondary">
          Quality Score
        </span>
        <span
          className={`text-2xl font-bold tabular-nums ${
            totalLevel === "excellent"
              ? "text-emerald-600"
              : totalLevel === "good"
                ? "text-amber-600"
                : totalLevel === "fair"
                  ? "text-orange-500"
                  : "text-red-500"
          }`}
        >
          {breakdown.total}
          <span className="text-sm font-normal text-text-tertiary">/100</span>
        </span>
      </div>

      {/* Dimension bars */}
      <div className="flex flex-col gap-3">
        {DIMENSIONS.map(({ key, label, icon }) => {
          const value = breakdown[key];
          const level = getScoreLevel(value);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 text-xs text-text-secondary truncate">
                {icon} {label}
              </span>
              <div
                className={`flex-1 h-2 rounded-full ${levelBarBg[level]}`}
              >
                <div
                  className={`h-full rounded-full transition-all ${levelColors[level]}`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium tabular-nums text-text-secondary">
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/agents/quality-breakdown.tsx
git commit -m "feat: add quality score breakdown component"
```

---

### Task 5: Update agent detail page and component

**Files:**
- Modify: `src/app/agents/[slug]/page.tsx`
- Modify: `src/components/agents/agent-detail.tsx`

**Step 1: Update the route page to fetch README and pass new data**

Replace `src/app/agents/[slug]/page.tsx` content. Key changes:
- Import `fetchReadme` from `@/lib/github`
- Import `markdownToHtml` from `@/lib/markdown`
- In `AgentPage`, call `fetchReadme(agent.repository)` and `markdownToHtml(readme)`
- Pass `readmeHtml` to `AgentDetail`

```tsx
// src/app/agents/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllAgents, getAgent, getStacksForAgent } from "@/lib/data";
import { AgentDetail } from "@/components/agents/agent-detail";
import { fetchReadme } from "@/lib/github";
import { markdownToHtml } from "@/lib/markdown";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const agents = getAllAgents();
  return agents.map((agent) => ({ slug: agent.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) return {};
  return {
    title: `${agent.name} — A2A Agent`,
    description: agent.description,
  };
}

export default async function AgentPage({ params }: PageProps) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  const stacks = getStacksForAgent(slug);

  // Fetch README from GitHub (returns null on failure)
  const readmeMarkdown = await fetchReadme(agent.repository);
  const readmeHtml = readmeMarkdown
    ? await markdownToHtml(readmeMarkdown)
    : null;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: agent.name,
      description: agent.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      url: `https://stacka2a.dev/agents/${slug}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://stacka2a.dev" },
        { "@type": "ListItem", position: 2, name: "Agents", item: "https://stacka2a.dev/agents" },
        { "@type": "ListItem", position: 3, name: agent.name },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AgentDetail agent={agent} stacks={stacks} readmeHtml={readmeHtml} />
    </>
  );
}
```

**Step 2: Rewrite agent-detail.tsx**

Key changes to `src/components/agents/agent-detail.tsx`:
- Add `readmeHtml` to props
- Replace "Quick Connect" `<SnippetPreview>` section with "Getting Started" section
- Add `<QualityBreakdown>` after header (replaces the standalone badge in the header)
- Add README section after Getting Started
- Remove `SnippetPreview` import
- Import `QualityBreakdown` and `generateGettingStarted`

The component keeps `QualityScoreBadge` in the header (compact display) and adds the full breakdown below.

```tsx
// src/components/agents/agent-detail.tsx
import Link from "next/link";
import type { A2AAgent, Stack } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { QualityScoreBadge } from "./quality-score-badge";
import { QualityBreakdown } from "./quality-breakdown";
import { generateGettingStarted } from "@/lib/getting-started";

interface AgentDetailProps {
  agent: A2AAgent;
  stacks: Stack[];
  readmeHtml: string | null;
}

export function AgentDetail({ agent, stacks, readmeHtml }: AgentDetailProps) {
  const steps = generateGettingStarted(agent);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col gap-8">
        {/* Header — unchanged */}
        <div className="flex flex-col gap-4 animate-fade-up">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{agent.category}</Badge>
            {agent.official && <Badge variant="default">Official</Badge>}
            {agent.framework !== "custom" && (
              <Badge variant="outline">{agent.framework}</Badge>
            )}
            {agent.language !== "unknown" && (
              <Badge variant="outline">{agent.language}</Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              {agent.name}
            </h1>
            <QualityScoreBadge agent={agent} size="lg" />
          </div>
          <p className="text-text-secondary">
            by{" "}
            {agent.provider.url ? (
              <a
                href={agent.provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary underline decoration-accent underline-offset-2 hover:decoration-accent-hover transition-colors"
              >
                {agent.provider.name}
              </a>
            ) : (
              <span className="text-text-primary font-medium">{agent.provider.name}</span>
            )}
          </p>
          <p className="text-lg leading-relaxed text-text-secondary">
            {agent.description}
          </p>

          {/* Metrics */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
            {agent.githubStars > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <StarIcon />
                {agent.githubStars.toLocaleString()} stars
              </span>
            )}
            <span>Updated {agent.lastUpdated}</span>
            {agent.license !== "unknown" && (
              <Badge variant="outline">{agent.license}</Badge>
            )}
          </div>
        </div>

        {/* Quality Score Breakdown — NEW */}
        <section className="animate-fade-up stagger-1">
          <QualityBreakdown agent={agent} />
        </section>

        {/* Getting Started — NEW (replaces Quick Connect) */}
        <section className="flex flex-col gap-3 animate-fade-up stagger-2">
          <h2 className="text-lg font-semibold text-text-primary">
            Getting Started
          </h2>
          <div className="flex flex-col gap-2">
            <StepBlock step={1} label="Clone the repository" command={steps.clone} />
            <StepBlock step={2} label="Navigate to the project" command={steps.navigate} />
            <StepBlock step={3} label="Install dependencies" command={steps.install} />
            <StepBlock step={4} label="Run the agent" command={steps.run} />
          </div>
          {steps.hostedEndpoint && (
            <p className="text-sm text-text-secondary mt-2">
              Or connect to the hosted endpoint:{" "}
              <a
                href={steps.hostedEndpoint}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-hover underline underline-offset-2"
              >
                {steps.hostedEndpoint}
              </a>
            </p>
          )}
        </section>

        {/* README — NEW */}
        {readmeHtml && (
          <section className="flex flex-col gap-3 animate-fade-up stagger-3">
            <h2 className="text-lg font-semibold text-text-primary">
              README
            </h2>
            <div
              className="blog-prose prose prose-slate max-w-none rounded-xl border border-border bg-surface-elevated p-6"
              dangerouslySetInnerHTML={{ __html: readmeHtml }}
            />
          </section>
        )}

        {/* Capabilities */}
        <section className="flex flex-col gap-3 animate-fade-up stagger-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Capabilities
          </h2>
          <div className="flex flex-wrap gap-2">
            <CapabilityBadge label="Streaming" enabled={agent.capabilities.streaming} />
            <CapabilityBadge label="Push Notifications" enabled={agent.capabilities.pushNotifications} />
            <CapabilityBadge label="Multi-Turn" enabled={agent.capabilities.multiTurn} />
            <Badge variant="outline">Auth: {agent.authType}</Badge>
          </div>
        </section>

        {/* Skills */}
        {agent.skills.length > 0 && (
          <section className="flex flex-col gap-3 animate-fade-up stagger-5">
            <h2 className="text-lg font-semibold text-text-primary">
              Skills ({agent.skills.length})
            </h2>
            <div className="flex flex-col gap-2">
              {agent.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-xl border border-border bg-surface-elevated p-4"
                >
                  <h3 className="font-medium text-text-primary">{skill.name}</h3>
                  {skill.description && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {skill.description}
                    </p>
                  )}
                  {skill.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {skill.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        {agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agent.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Part of these stacks */}
        {stacks.length > 0 && (
          <section className="flex flex-col gap-3 animate-fade-up">
            <h2 className="text-lg font-semibold text-text-primary">
              Part of these stacks
            </h2>
            <div className="flex flex-wrap gap-2">
              {stacks.map((stack) => (
                <Link
                  key={stack.slug}
                  href={`/stacks/${stack.slug}`}
                  className="card-hover rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-text-primary transition-all hover:border-accent/30 hover:text-accent"
                >
                  {stack.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Links */}
        <section className="flex gap-3 border-t border-border pt-6">
          {agent.repository && (
            <a
              href={agent.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-text-primary px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              <GithubIcon />
              View on GitHub
            </a>
          )}
          {agent.agentCardUrl && (
            <a
              href={agent.agentCardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
            >
              Agent Card
            </a>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function StepBlock({
  step,
  label,
  command,
}: {
  step: number;
  label: string;
  command: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
          {step}
        </span>
        <span className="text-sm font-medium text-text-primary">{label}</span>
      </div>
      <div className="rounded-lg bg-code-bg px-3 py-2 font-mono text-sm text-code-text">
        <span className="text-accent select-none">$ </span>
        {command}
      </div>
    </div>
  );
}

function CapabilityBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
        enabled
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-stone-50 text-stone-400 border border-stone-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-stone-300"}`} />
      {label}
    </span>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/agents/[slug]/page.tsx src/components/agents/agent-detail.tsx
git commit -m "feat: replace Quick Connect with Getting Started, Quality Breakdown, and README"
```

---

### Task 6: Verify full build

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Build the site**

Run: `GITHUB_TOKEN=${GITHUB_TOKEN:-} npx next build 2>&1 | tail -20`
Expected: Build succeeds. Agent detail pages are statically generated.

**Step 3: Spot-check a few pages**

Run: `npx next start &` then check:
- `http://localhost:3000/agents/google-a2a` — should show README, quality breakdown, getting started
- `http://localhost:3000/agents/coin-railz` — should show skills section (has 33 skills)
- Blog pages still work

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build issues from agent detail enrichment"
```
