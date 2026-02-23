import fs from "fs";
import path from "path";
import type { A2AAgent, Stack } from "./types";

const AGENTS_DIR = path.join(process.cwd(), "src/data/agents");
const STACKS_DIR = path.join(process.cwd(), "src/data/stacks");

export function getAllAgents(): A2AAgent[] {
  const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, f), "utf-8")))
    .sort((a, b) => b.githubStars - a.githubStars);
}

export function getAgent(slug: string): A2AAgent | null {
  const filePath = path.join(AGENTS_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getAllStacks(): Stack[] {
  const files = fs.readdirSync(STACKS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(STACKS_DIR, f), "utf-8"))
  );
}

export function getStack(slug: string): Stack | null {
  const filePath = path.join(STACKS_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getStackWithAgents(
  slug: string
): { stack: Stack; agents: A2AAgent[] } | null {
  const stack = getStack(slug);
  if (!stack) return null;
  const agents = stack.agents
    .map((s) => getAgent(s))
    .filter((s): s is A2AAgent => s !== null);
  return { stack, agents };
}

export function getAgentCategories(): string[] {
  const agents = getAllAgents();
  const categories = new Set(agents.map((a) => a.category));
  return [...categories].sort();
}

export function getAgentsByCategory(category: string): A2AAgent[] {
  return getAllAgents().filter((a) => a.category === category);
}

export function getStacksForAgent(agentSlug: string): Stack[] {
  return getAllStacks().filter((s) => s.agents.includes(agentSlug));
}

export function getAgentFrameworks(): string[] {
  const agents = getAllAgents();
  const frameworks = new Set(agents.map((a) => a.framework));
  return [...frameworks].sort();
}

export function getAgentLanguages(): string[] {
  const agents = getAllAgents();
  const languages = new Set(agents.map((a) => a.language));
  return [...languages].sort();
}
