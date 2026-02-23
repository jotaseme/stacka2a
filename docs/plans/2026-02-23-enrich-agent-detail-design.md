# Enrich Agent Detail Page

## Problem

Agent detail pages (`/agents/[slug]`) add no value over the card in the listing. The "Quick Connect" section shows identical generic code snippets for every agent (only a comment with the agent name changes). The `endpointUrl` field is rarely populated, and when it is, it's often not a real A2A endpoint. The page doesn't justify its existence.

## Solution

Replace generic content with three useful sections:

1. **Quality Score Breakdown** — visual decomposition of the 6 scoring components
2. **Getting Started** — real setup steps based on language/framework/repo
3. **README from GitHub** — the actual repository README fetched at build time

## Design

### Page Structure (top to bottom)

1. **Header** — unchanged (name, badges, provider, description, stars, date, license)
2. **Quality Score Breakdown** — NEW
3. **Getting Started** — NEW (replaces Quick Connect)
4. **README** — NEW (main content section)
5. **Capabilities** — unchanged
6. **Skills** — unchanged (appears when data exists)
7. **Tags + Stacks + Links** — unchanged

### Section: Quality Score Breakdown

The current badge shows only the total number (e.g. "72"). Replace with a detailed breakdown showing all 6 components from `computeQualityScore()`:

- Community (stars) — horizontal bar, 0-100
- Freshness — horizontal bar, 0-100
- Official — horizontal bar, 0-100
- Skill Maturity — horizontal bar, 0-100
- Protocol Compliance — horizontal bar, 0-100
- Auth Security — horizontal bar, 0-100

Each bar colored by level (green/yellow/orange/red). Total score prominent above.
Server component — no client JS needed.

### Section: Getting Started

Replace the generic "Quick Connect" snippet with real, actionable setup steps:

1. `git clone {repository}` (parsed from agent data)
2. Install command based on `language`: pip/npm/go mod/mvn/dotnet
3. Run command based on `framework` + `language`
4. Connection snippet pointing to `localhost` (only after setup)

If `endpointUrl` exists, show alternative: "Or connect to hosted endpoint: {url}"

Server component generating steps from existing agent data.

### Section: README

Fetch the repository README from GitHub API at build time:

**Fetch logic:**
- Parse `repository` URL to extract `owner`, `repo`, and optional `path` (for monorepos)
- Monorepo (has path): `GET /repos/{owner}/{repo}/contents/{path}/README.md`
- Standalone repo: `GET /repos/{owner}/{repo}/readme`
- API returns base64 content → decode → markdown
- Requires `GITHUB_TOKEN` env var (5000 req/hr, sufficient for 256 agents)

**Rendering:**
- Reuse the same remark/rehype pipeline from `src/lib/blog.ts`
- Extract `markdownToHtml()` as shared function
- Render with `blog-prose` CSS class for consistent styling

**Sanitization:**
- Convert relative image URLs to absolute GitHub raw URLs
- Convert relative links to absolute repo URLs

**Graceful degradation:**
- If fetch fails or README doesn't exist: section not shown
- Build doesn't fail on GitHub API errors

### Files Changed

| File | Change |
|------|--------|
| `src/lib/github.ts` | NEW — `parseRepoUrl(url)`, `fetchReadme(repoUrl)` |
| `src/lib/blog.ts` | Extract `markdownToHtml(md)` from `getPost()` |
| `src/lib/getting-started.ts` | NEW — `generateGettingStarted(agent)` |
| `src/app/agents/[slug]/page.tsx` | Call `fetchReadme()`, `markdownToHtml()`, pass data to component |
| `src/components/agents/agent-detail.tsx` | Add Quality Breakdown, Getting Started, README sections. Remove Quick Connect |
| `src/components/agents/quality-breakdown.tsx` | NEW — horizontal bar chart for 6 score components |

### What Gets Removed

- "Quick Connect" section with `SnippetPreview` from agent detail
- `SnippetPreview` component stays (used by stacks pages)

### Environment

- `GITHUB_TOKEN` env var required for build
- No runtime dependencies added — everything is static generation
