/**
 * A2A Agent Crawler
 *
 * Discovers A2A agents from multiple sources and outputs normalized
 * JSON files to src/data/agents/. Run with: npx tsx scripts/crawl.ts
 *
 * Sources:
 * 1. prassanna-ravishankar/a2a-registry (103 agent cards in JSON)
 * 2. GitHub Search API (topic:a2a-protocol repos)
 * 3. a2aproject org repos (official SDKs & samples)
 * 4. awesome-a2a README (ai-boost/awesome-a2a)
 *
 * Requires GITHUB_TOKEN env var for higher rate limits (5000/h vs 60/h).
 */

import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RawAgentCard {
  name?: string;
  description?: string;
  url?: string;
  version?: string;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    multiTurn?: boolean;
    stateTransitionHistory?: boolean;
  };
  skills?: Array<{
    id?: string;
    name?: string;
    description?: string;
    tags?: string[];
    inputModes?: string[];
    outputModes?: string[];
    examples?: string[];
  }>;
  provider?: {
    organization?: string;
    name?: string;
    url?: string;
  };
  preferredTransport?: string;
  documentationUrl?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  wellKnownURI?: string;
  registryTags?: string[];
  protocolVersion?: string;
}

interface GitHubRepo {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  license: { spdx_id: string } | null;
  pushed_at: string;
  created_at: string;
  archived: boolean;
  owner: { login: string; avatar_url: string };
}

interface NormalizedAgent {
  slug: string;
  name: string;
  description: string;
  provider: { name: string; url?: string };
  repository: string;
  category: string;
  tags: string[];
  framework: string;
  language: string;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    inputModes?: string[];
    outputModes?: string[];
  }>;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    multiTurn: boolean;
  };
  authType: string;
  agentCardUrl?: string;
  endpointUrl?: string;
  sdks: string[];
  githubStars: number;
  lastUpdated: string;
  official: boolean;
  selfHosted: boolean;
  license: string;
  sources: string[];
}

// ─── Config ─────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const OUTPUT_DIR = path.join(process.cwd(), "src/data/agents");
const HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "User-Agent": "StackA2A-Crawler/1.0",
};
if (GITHUB_TOKEN) {
  HEADERS["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchJSON(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, { headers: { ...HEADERS, ...headers } });
  if (!res.ok) {
    console.warn(`  WARN: ${res.status} fetching ${url}`);
    return null;
  }
  return res.json();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function detectFramework(text: string, topics: string[] = []): string {
  const all = (text + " " + topics.join(" ")).toLowerCase();
  if (all.includes("google-adk") || all.includes("google_adk") || all.includes("adk"))
    return "google-adk";
  if (all.includes("langgraph")) return "langgraph";
  if (all.includes("crewai") || all.includes("crew-ai")) return "crewai";
  if (all.includes("autogen") || all.includes("ag2")) return "autogen";
  if (all.includes("semantic-kernel") || all.includes("semantickernel"))
    return "semantic-kernel";
  if (all.includes("spring-boot") || all.includes("spring")) return "spring-boot";
  if (all.includes("langchain")) return "langchain";
  if (all.includes("llamaindex") || all.includes("llama-index") || all.includes("llama_index"))
    return "llamaindex";
  if (all.includes("genkit")) return "genkit";
  if (all.includes("nestjs")) return "nestjs";
  if (all.includes("fastapi") || all.includes("fasta2a")) return "fastapi";
  return "custom";
}

function detectLanguage(lang: string | null | undefined, text: string = ""): string {
  const l = (lang || "").toLowerCase();
  const t = text.toLowerCase();
  if (l === "python" || t.includes("python") || t.includes("pip install")) return "python";
  if (l === "typescript" || l === "javascript" || t.includes("typescript") || t.includes("npm"))
    return "typescript";
  if (l === "java" || l === "kotlin" || t.includes("java") || t.includes("spring"))
    return "java";
  if (l === "go" || t.includes("golang")) return "go";
  if (l === "c#" || l === "csharp" || t.includes("dotnet") || t.includes("c#"))
    return "csharp";
  if (l === "rust") return "rust";
  return "unknown";
}

function detectCategory(
  name: string,
  desc: string,
  tags: string[] = []
): string {
  const all = (name + " " + desc + " " + tags.join(" ")).toLowerCase();
  if (all.match(/code|coder|programming|developer|github|git\b/)) return "code-generation";
  if (all.match(/search|retrieval|web.*search|crawl/)) return "search";
  if (all.match(/data|analytics|csv|database|sql/)) return "data-analytics";
  if (all.match(/image|video|media|creative|content.*writ/)) return "media-content";
  if (all.match(/enterprise|workflow|expense|calendar|crm|erp/)) return "enterprise";
  if (all.match(/travel|flight|hotel|booking/)) return "travel";
  if (all.match(/devops|docker|kubernetes|deploy|infra|monitor/)) return "infrastructure";
  if (all.match(/chat|conversation|assistant|hello|greeting/)) return "conversational";
  if (all.match(/auth|security|oauth|encrypt/)) return "security";
  if (all.match(/orchestrat|multi.*agent|coordinator|swarm/)) return "orchestration";
  if (all.match(/finance|payment|invoice|accounting/)) return "finance";
  if (all.match(/weather|utility|tool|calculator/)) return "utility";
  return "general";
}

function isoDate(d: string | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0];
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

// ─── Source 1: a2a-registry repo ────────────────────────────────────────────

async function crawlA2ARegistry(): Promise<NormalizedAgent[]> {
  console.log("\n[1/4] Crawling prassanna-ravishankar/a2a-registry...");
  const agents: NormalizedAgent[] = [];

  // Get file listing
  const tree = await fetchJSON(
    "https://api.github.com/repos/prassanna-ravishankar/a2a-registry/git/trees/main?recursive=1"
  );
  if (!tree?.tree) {
    console.warn("  Could not fetch registry tree");
    return agents;
  }

  const agentFiles = tree.tree.filter(
    (f: { path: string }) => f.path.startsWith("agents/") && f.path.endsWith(".json")
  );
  console.log(`  Found ${agentFiles.length} agent files`);

  for (const file of agentFiles) {
    const raw = (await fetchJSON(
      `https://raw.githubusercontent.com/prassanna-ravishankar/a2a-registry/main/${file.path}`
    )) as RawAgentCard | null;
    if (!raw || !raw.name) continue;

    const slug = slugify(raw.name);
    const desc = raw.description || "";
    const tags = raw.registryTags || raw.skills?.flatMap((s) => s.tags || []) || [];

    agents.push({
      slug,
      name: raw.name,
      description: desc,
      provider: {
        name: raw.provider?.organization || raw.provider?.name || raw.author || "Unknown",
        url: raw.provider?.url || raw.homepage,
      },
      repository: raw.repository || "",
      category: detectCategory(raw.name, desc, tags),
      tags: [...new Set(tags)].slice(0, 10),
      framework: detectFramework(desc, tags),
      language: detectLanguage(null, desc),
      skills: (raw.skills || []).map((s) => ({
        id: s.id || slugify(s.name || "skill"),
        name: s.name || "Unknown Skill",
        description: s.description || "",
        tags: s.tags || [],
        inputModes: s.inputModes,
        outputModes: s.outputModes,
      })),
      capabilities: {
        streaming: raw.capabilities?.streaming || false,
        pushNotifications: raw.capabilities?.pushNotifications || false,
        multiTurn:
          raw.capabilities?.stateTransitionHistory ||
          (raw.capabilities as Record<string, boolean>)?.multiTurn ||
          false,
      },
      authType: "none",
      agentCardUrl: raw.wellKnownURI || (raw.url ? `${raw.url}/.well-known/agent-card.json` : undefined),
      endpointUrl: raw.url,
      sdks: detectSdks(raw),
      githubStars: 0,
      lastUpdated: isoDate(undefined),
      official: false,
      selfHosted: true,
      license: raw.license || "unknown",
      sources: ["a2a-registry"],
    });
  }

  console.log(`  Normalized ${agents.length} agents`);
  return agents;
}

function detectSdks(card: RawAgentCard): string[] {
  const sdks: string[] = [];
  const text = JSON.stringify(card).toLowerCase();
  if (text.includes("python") || text.includes("pip")) sdks.push("python");
  if (text.includes("typescript") || text.includes("javascript") || text.includes("npm"))
    sdks.push("typescript");
  if (text.includes("java") || text.includes("spring")) sdks.push("java");
  if (text.includes("go") || text.includes("golang")) sdks.push("go");
  if (text.includes("csharp") || text.includes("dotnet") || text.includes(".net"))
    sdks.push("csharp");
  return sdks.length > 0 ? sdks : ["python", "typescript"];
}

// ─── Source 2: GitHub Search ────────────────────────────────────────────────

async function crawlGitHubSearch(): Promise<NormalizedAgent[]> {
  console.log("\n[2/4] Crawling GitHub Search API (topic:a2a-protocol)...");
  const agents: NormalizedAgent[] = [];
  let page = 1;
  let total = 0;

  while (page <= 5) {
    const data = await fetchJSON(
      `https://api.github.com/search/repositories?q=topic:a2a-protocol&sort=stars&order=desc&per_page=100&page=${page}`
    );
    if (!data?.items?.length) break;
    total += data.items.length;

    for (const repo of data.items as GitHubRepo[]) {
      if (repo.archived) continue;
      // Skip the main spec repo, SDKs, and meta repos
      if (repo.full_name.startsWith("a2aproject/A2A")) continue;
      if (repo.full_name.match(/a2aproject\/(a2a-python|a2a-js|a2a-java|a2a-go|a2a-dotnet|a2a-tck|a2a-inspector)/))
        continue;
      // Skip awesome lists
      if (repo.name.match(/^awesome/i)) continue;

      const slug = slugify(repo.name);
      const desc = repo.description || "";

      agents.push({
        slug,
        name: formatRepoName(repo.name),
        description: desc,
        provider: {
          name: repo.owner.login,
          url: `https://github.com/${repo.owner.login}`,
        },
        repository: repo.html_url,
        category: detectCategory(repo.name, desc, repo.topics),
        tags: repo.topics.filter((t) => t !== "a2a-protocol" && t !== "a2a").slice(0, 10),
        framework: detectFramework(desc, repo.topics),
        language: detectLanguage(repo.language, desc),
        skills: [],
        capabilities: { streaming: false, pushNotifications: false, multiTurn: false },
        authType: "none",
        agentCardUrl: undefined,
        endpointUrl: repo.homepage || undefined,
        sdks: detectSdksFromLanguage(repo.language),
        githubStars: repo.stargazers_count,
        lastUpdated: isoDate(repo.pushed_at),
        official: repo.full_name.startsWith("a2aproject/") || repo.full_name.startsWith("google/"),
        selfHosted: true,
        license: repo.license?.spdx_id || "unknown",
        sources: ["github-search"],
      });
    }

    if (data.items.length < 100) break;
    page++;
    // Respect rate limits
    await sleep(2000);
  }

  console.log(`  Found ${total} repos, normalized ${agents.length} agents`);
  return agents;
}

function formatRepoName(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bA2a\b/gi, "A2A")
    .replace(/\bMcp\b/gi, "MCP")
    .replace(/\bSdk\b/gi, "SDK")
    .replace(/\bApi\b/gi, "API");
}

function detectSdksFromLanguage(lang: string | null): string[] {
  switch (lang?.toLowerCase()) {
    case "python":
      return ["python"];
    case "typescript":
    case "javascript":
      return ["typescript"];
    case "java":
    case "kotlin":
      return ["java"];
    case "go":
      return ["go"];
    case "c#":
      return ["csharp"];
    default:
      return ["python", "typescript"];
  }
}

// ─── Source 3: a2aproject official samples ───────────────────────────────────

async function crawlOfficialSamples(): Promise<NormalizedAgent[]> {
  console.log("\n[3/4] Crawling a2aproject/a2a-samples...");
  const agents: NormalizedAgent[] = [];

  const tree = await fetchJSON(
    "https://api.github.com/repos/a2aproject/a2a-samples/git/trees/main?recursive=1"
  );
  if (!tree?.tree) {
    console.warn("  Could not fetch samples tree");
    return agents;
  }

  // Find agent directories under samples/python/agents/
  const agentDirs = new Set<string>();
  for (const f of tree.tree) {
    const match = (f.path as string).match(
      /^samples\/(python|dotnet|go|java)\/agents\/([^/]+)\//
    );
    if (match) {
      agentDirs.add(`${match[1]}/${match[2]}`);
    }
  }

  console.log(`  Found ${agentDirs.size} sample agent directories`);

  for (const dir of agentDirs) {
    const [lang, name] = dir.split("/");
    const slug = slugify(`a2a-sample-${name}`);

    agents.push({
      slug,
      name: `${formatRepoName(name)} (Official Sample)`,
      description: `Official A2A ${lang} sample agent: ${formatRepoName(name)}`,
      provider: { name: "A2A Project", url: "https://github.com/a2aproject" },
      repository: `https://github.com/a2aproject/a2a-samples/tree/main/samples/${lang}/agents/${name}`,
      category: detectCategory(name, "", []),
      tags: ["official-sample", lang],
      framework: detectFramework(name, []),
      language: detectLanguage(lang),
      skills: [],
      capabilities: { streaming: false, pushNotifications: false, multiTurn: false },
      authType: "none",
      sdks: [detectLanguage(lang)].filter((l) => l !== "unknown"),
      githubStars: 1329,
      lastUpdated: isoDate(undefined),
      official: true,
      selfHosted: true,
      license: "apache-2.0",
      sources: ["a2a-samples"],
    });
  }

  console.log(`  Normalized ${agents.length} agents`);
  return agents;
}

// ─── Source 4: GitHub topic:a2a (broader search) ────────────────────────────

async function crawlGitHubBroadSearch(): Promise<NormalizedAgent[]> {
  console.log("\n[4/4] Crawling GitHub Search API (topic:agent2agent)...");
  const agents: NormalizedAgent[] = [];

  const data = await fetchJSON(
    "https://api.github.com/search/repositories?q=topic:agent2agent&sort=stars&order=desc&per_page=100"
  );
  if (!data?.items) return agents;

  for (const repo of data.items as GitHubRepo[]) {
    if (repo.archived) continue;
    if (repo.full_name.startsWith("a2aproject/")) continue;
    if (repo.name.match(/^awesome/i)) continue;

    const slug = slugify(repo.name);
    const desc = repo.description || "";

    agents.push({
      slug,
      name: formatRepoName(repo.name),
      description: desc,
      provider: {
        name: repo.owner.login,
        url: `https://github.com/${repo.owner.login}`,
      },
      repository: repo.html_url,
      category: detectCategory(repo.name, desc, repo.topics),
      tags: repo.topics.filter((t) => t !== "agent2agent" && t !== "a2a").slice(0, 10),
      framework: detectFramework(desc, repo.topics),
      language: detectLanguage(repo.language, desc),
      skills: [],
      capabilities: { streaming: false, pushNotifications: false, multiTurn: false },
      authType: "none",
      endpointUrl: repo.homepage || undefined,
      sdks: detectSdksFromLanguage(repo.language),
      githubStars: repo.stargazers_count,
      lastUpdated: isoDate(repo.pushed_at),
      official: false,
      selfHosted: true,
      license: repo.license?.spdx_id || "unknown",
      sources: ["github-search-broad"],
    });
  }

  console.log(`  Found ${data.items.length} repos, normalized ${agents.length} agents`);
  return agents;
}

// ─── Merge & Deduplicate ────────────────────────────────────────────────────

function mergeAgents(allSources: NormalizedAgent[][]): NormalizedAgent[] {
  const bySlug = new Map<string, NormalizedAgent>();

  // Priority: a2a-registry > a2a-samples > github-search > github-search-broad
  for (const source of allSources) {
    for (const agent of source) {
      const existing = bySlug.get(agent.slug);
      if (!existing) {
        bySlug.set(agent.slug, agent);
      } else {
        // Merge: keep richer data, combine sources
        existing.sources = [...new Set([...existing.sources, ...agent.sources])];
        // Prefer registry data for skills/capabilities (more detailed)
        if (agent.sources.includes("a2a-registry") && agent.skills.length > 0) {
          existing.skills = agent.skills;
          existing.capabilities = agent.capabilities;
          existing.agentCardUrl = agent.agentCardUrl || existing.agentCardUrl;
          existing.endpointUrl = agent.endpointUrl || existing.endpointUrl;
        }
        // Always take higher stars
        if (agent.githubStars > existing.githubStars) {
          existing.githubStars = agent.githubStars;
        }
        // Take most recent update
        if (agent.lastUpdated > existing.lastUpdated) {
          existing.lastUpdated = agent.lastUpdated;
        }
        // Prefer non-empty fields
        if (!existing.repository && agent.repository) existing.repository = agent.repository;
        if (existing.language === "unknown" && agent.language !== "unknown")
          existing.language = agent.language;
        if (existing.framework === "custom" && agent.framework !== "custom")
          existing.framework = agent.framework;
        if (existing.license === "unknown" && agent.license !== "unknown")
          existing.license = agent.license;
        // Merge tags
        existing.tags = [...new Set([...existing.tags, ...agent.tags])].slice(0, 15);
      }
    }
  }

  return [...bySlug.values()];
}

// ─── Filter quality ─────────────────────────────────────────────────────────

function filterLowQuality(agents: NormalizedAgent[]): NormalizedAgent[] {
  return agents.filter((a) => {
    // Must have a name and description
    if (!a.name || a.name.length < 3) return false;
    if (!a.description || a.description.length < 10) return false;
    // Must have a repo or endpoint
    if (!a.repository && !a.endpointUrl) return false;
    return true;
  });
}

// ─── Output ─────────────────────────────────────────────────────────────────

function writeAgents(agents: NormalizedAgent[]) {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Track which files we write (to clean up stale ones)
  const writtenFiles = new Set<string>();

  for (const agent of agents) {
    // Remove internal sources field from output
    const { sources, ...output } = agent;
    const filePath = path.join(OUTPUT_DIR, `${agent.slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2) + "\n");
    writtenFiles.add(`${agent.slug}.json`);
  }

  // Remove stale files that no longer exist in crawl results
  const existingFiles = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".json"));
  let removed = 0;
  for (const file of existingFiles) {
    if (!writtenFiles.has(file)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
      removed++;
    }
  }

  console.log(`\nWrote ${agents.length} agent files to ${OUTPUT_DIR}`);
  if (removed > 0) console.log(`Removed ${removed} stale files`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== StackA2A Crawler ===");
  console.log(`GitHub token: ${GITHUB_TOKEN ? "present" : "NOT SET (60 req/h limit)"}`);

  const [registry, search, samples, broad] = await Promise.all([
    crawlA2ARegistry(),
    crawlGitHubSearch(),
    crawlOfficialSamples(),
    crawlGitHubBroadSearch(),
  ]);

  console.log("\n--- Merging & deduplicating ---");
  const merged = mergeAgents([registry, samples, search, broad]);
  console.log(`  Total after merge: ${merged.length}`);

  const filtered = filterLowQuality(merged);
  console.log(`  After quality filter: ${filtered.length}`);

  // Sort by stars descending
  filtered.sort((a, b) => b.githubStars - a.githubStars);

  writeAgents(filtered);

  // Print summary
  console.log("\n=== Summary ===");
  console.log(`  Registry agents: ${registry.length}`);
  console.log(`  GitHub search (a2a-protocol): ${search.length}`);
  console.log(`  Official samples: ${samples.length}`);
  console.log(`  GitHub search (agent2agent): ${broad.length}`);
  console.log(`  Final (merged + filtered): ${filtered.length}`);

  const categories = new Map<string, number>();
  const frameworks = new Map<string, number>();
  const languages = new Map<string, number>();
  for (const a of filtered) {
    categories.set(a.category, (categories.get(a.category) || 0) + 1);
    frameworks.set(a.framework, (frameworks.get(a.framework) || 0) + 1);
    languages.set(a.language, (languages.get(a.language) || 0) + 1);
  }

  console.log("\n  Categories:");
  for (const [k, v] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${v}`);
  }
  console.log("\n  Frameworks:");
  for (const [k, v] of [...frameworks.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${v}`);
  }
  console.log("\n  Languages:");
  for (const [k, v] of [...languages.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${v}`);
  }
}

main().catch((err) => {
  console.error("Crawler failed:", err);
  process.exit(1);
});
