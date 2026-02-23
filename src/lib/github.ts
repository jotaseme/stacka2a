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
