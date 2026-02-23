# SEO Expansion Design — StackA2A

**Date:** 2026-02-23
**Status:** Approved

---

## Scope

7 items from PRODUCT_ANALYSIS.md (newsletter dropped):

1. Static category pages for agents (~24 pages)
2. Fix canonical URLs across all pages
3. /submit-agent page with form
4. /learn section with 4 pillar guides
5. Breadcrumbs UI + FAQ page with FAQPage schema
6. 20 long-tail blog posts
7. Related Posts component in blog

## Decisions

- **Backend:** No backend. Submit-agent form uses Formspree (free tier, 50/month) sending to contact@stacka2a.dev. Placeholder URL until configured.
- **Newsletter:** Dropped from scope.
- **Content:** All 20 blog posts + 4 learn guides written with full content. Same tone as existing posts: direct, opinionated, working code, no filler.
- **Navigation:** Add "Learn" to header between Tools and Blog. Add "Submit Agent" and "FAQ" to footer.

---

## 1. Static Category Pages

### Routes

```
src/app/agents/category/[slug]/page.tsx   -> /agents/category/{slug}
src/app/agents/framework/[slug]/page.tsx  -> /agents/framework/{slug}
src/app/agents/language/[slug]/page.tsx   -> /agents/language/{slug}
```

### generateStaticParams

Extract unique values from agent data:
- Categories (~13): code-generation, data-analytics, enterprise, infrastructure, multi-agent, image-media, search-research, security-auth, utility, finance, orchestration, content-creation, communication
- Frameworks (~6): google-adk, langgraph, crewai, spring-boot, autogen, custom
- Languages (~5): python, typescript, java, go, csharp

### Each page

- generateMetadata with SEO title ("Best A2A Agents for {Category}"), description, canonical, OG
- JSON-LD: ItemList + BreadcrumbList
- Header with category name, agent count, description
- Grid of AgentCard components (reuse existing)
- Links to related categories at bottom
- Breadcrumbs UI component

### Data layer additions (src/lib/data.ts)

- `getAgentsByCategory(category: string): A2AAgent[]`
- `getAgentsByFramework(framework: string): A2AAgent[]`
- `getAgentsByLanguage(language: string): A2AAgent[]`
- `getAllCategories(): string[]`
- `getAllFrameworks(): string[]`
- `getAllLanguages(): string[]`
- Category/framework/language display names and descriptions map

---

## 2. Fix Canonical URLs

Add `alternates: { canonical: "https://stacka2a.dev/..." }` to generateMetadata in:

- src/app/agents/page.tsx
- src/app/agents/[slug]/page.tsx
- src/app/stacks/page.tsx
- src/app/stacks/[slug]/page.tsx
- src/app/blog/page.tsx
- src/app/blog/[slug]/page.tsx
- src/app/tools/page.tsx
- src/app/tools/agent-card-validator/page.tsx
- src/app/tools/agent-discovery/page.tsx
- src/app/tools/sdk-playground/page.tsx
- All new pages (category, learn, faq, submit-agent)

---

## 3. /submit-agent

### Route

`src/app/submit-agent/page.tsx`

### Form fields

- Agent name (text, required)
- Repository URL (url, required)
- Agent Card URL (url, optional)
- Category (select from existing categories)
- Framework (select from existing frameworks)
- Language (select from existing languages)
- Description (textarea, required)
- Contact email (email, required)

### Implementation

HTML form with `action` pointing to Formspree endpoint. No JS submission. Success redirect to /submit-agent?submitted=true with thank-you message.

### SEO

- Title: "Submit Your A2A Agent | StackA2A"
- Canonical URL
- No special JSON-LD

### Navigation

- Link in footer: "Submit Agent"
- CTA button on /agents page

---

## 4. /learn Section

### Routes

```
src/app/learn/page.tsx              -> /learn (index with 4 cards)
src/app/learn/[slug]/page.tsx       -> /learn/{slug}
```

### Content files

```
src/content/learn/what-is-a2a.md
src/content/learn/agent-card-spec.md
src/content/learn/sdks-by-language.md
src/content/learn/security-guide.md
```

### Each guide

- 3000+ words, pillar content quality
- Reuse blog-toc.tsx for sidebar TOC
- JSON-LD: BlogPosting + BreadcrumbList
- OG image (reuse blog pattern)
- generateMetadata with canonical
- Breadcrumbs UI

### Index page

Grid of 4 cards with icon, title, description, reading time.

### Navigation

Add "Learn" to header navItems between "Tools" and "Blog".

### Data layer

New `src/lib/learn.ts` mirroring `src/lib/blog.ts` for learn content.

---

## 5. Breadcrumbs UI + FAQ

### Breadcrumbs component

`src/components/ui/breadcrumbs.tsx`

```tsx
interface BreadcrumbItem {
  label: string;
  href?: string; // last item has no href
}

<Breadcrumbs items={[...]} />
```

Style: text-xs, text-tertiary, separator " / ", last item text-secondary. Placed below header in all detail pages.

### Pages that get breadcrumbs

- /agents/[slug]
- /agents/category/[slug]
- /agents/framework/[slug]
- /agents/language/[slug]
- /stacks/[slug]
- /blog/[slug]
- /learn/[slug]
- /compare/[slugs]
- /faq
- /submit-agent

### FAQ page

Route: `src/app/faq/page.tsx`

~15 questions in 3 sections:
- A2A Protocol (what is it, how agents communicate, agent cards, A2A vs MCP)
- StackA2A (what is it, quality scores, update frequency, how to submit)
- Technical (SDKs, connecting, streaming, multi-turn)

JSON-LD: FAQPage schema for Google featured snippets.

Navigation: Link in footer.

---

## 6. 20 Blog Posts

All in src/content/blog/. Frontmatter: title, description, date, readingTime, tags, relatedStacks, relatedAgents.

Style: direct, opinionated, working code, no filler. Same voice as existing posts.

Full list with slugs in PRODUCT_ANALYSIS.md and brainstorming conversation.

---

## 7. Related Posts in Blog

### Component

`src/components/blog/related-posts.tsx`

### Logic

1. Get current post tags
2. Find posts sharing >= 1 tag (exclude current)
3. Sort by shared tag count descending
4. Show top 3

### Display

3 cards at bottom of blog post, before footer. Each card: title, description, date, reading time.

### Integration

Render in src/app/blog/[slug]/page.tsx after blog content.
