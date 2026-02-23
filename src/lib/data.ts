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

export function getAgentsByFramework(framework: string): A2AAgent[] {
  return getAllAgents().filter((a) => a.framework === framework);
}

export function getAgentsByLanguage(language: string): A2AAgent[] {
  return getAllAgents().filter((a) => a.language === language);
}

export function getPostsForAgent(agentSlug: string) {
  // Lazy import to avoid circular dependency
  const { getAllPosts } = require("./blog");
  const posts = getAllPosts() as import("./types").BlogPost[];
  return posts.filter(
    (post) => post.relatedAgents && post.relatedAgents.includes(agentSlug)
  );
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
  healthcare: { label: "Healthcare", description: "A2A agents for diagnostics, medical records, patient data, and clinical workflows." },
  "supply-chain": { label: "Supply Chain", description: "A2A agents for logistics, procurement, shipping, and warehouse coordination." },
  "customer-service": { label: "Customer Service", description: "A2A agents for support tickets, chatbot coordination, escalation, and CRM integration." },
  devops: { label: "DevOps", description: "A2A agents for CI/CD pipelines, monitoring, incident response, and deployment automation." },
};

export const FRAMEWORK_DISPLAY: Record<string, { label: string; description: string }> = {
  "google-adk": { label: "Google ADK", description: "Agents built with Google's Agent Development Kit — the most mature A2A framework with built-in Agent Card generation and streaming." },
  langgraph: { label: "LangGraph", description: "Agents built with LangChain's LangGraph framework for stateful, multi-step agent workflows." },
  crewai: { label: "CrewAI", description: "Agents built with CrewAI for role-based multi-agent collaboration and task delegation." },
  "spring-boot": { label: "Spring Boot", description: "A2A agents for the Java/Kotlin ecosystem, built on Spring Boot for enterprise deployments." },
  autogen: { label: "AutoGen", description: "Agents built with Microsoft's AutoGen framework for multi-agent conversations and self-correcting loops." },
  "pydantic-ai": { label: "Pydantic AI", description: "Agents built with PydanticAI and FastA2A for type-safe, production-grade A2A servers." },
  "semantic-kernel": { label: "Semantic Kernel", description: "Agents built with Microsoft's Semantic Kernel for enterprise .NET and Python deployments." },
  "openai-agents": { label: "OpenAI Agents", description: "Agents built with OpenAI's Agents SDK, wrapped with A2A protocol support." },
  llamaindex: { label: "LlamaIndex", description: "Agents built with LlamaIndex for RAG pipelines and document-aware A2A interactions." },
  "strands-agents": { label: "AWS Strands", description: "Agents built with AWS Strands Agents SDK for Amazon Bedrock deployments." },
  fastapi: { label: "FastAPI", description: "Agents built directly on FastAPI with custom A2A protocol implementation." },
  genkit: { label: "Genkit", description: "Agents built with Firebase Genkit for Google Cloud-native A2A deployments." },
  custom: { label: "Custom Framework", description: "Agents built with custom or minimal frameworks, directly implementing the A2A protocol." },
};

export const LANGUAGE_DISPLAY: Record<string, { label: string; description: string }> = {
  python: { label: "Python", description: "A2A agents written in Python — the most popular language in the A2A ecosystem." },
  typescript: { label: "TypeScript", description: "A2A agents written in TypeScript for Node.js and Deno runtimes." },
  java: { label: "Java", description: "A2A agents written in Java, typically using Spring Boot for enterprise environments." },
  go: { label: "Go", description: "A2A agents written in Go for high-performance, low-footprint deployments." },
  csharp: { label: "C#", description: "A2A agents written in C# for the .NET ecosystem and Azure integration." },
  rust: { label: "Rust", description: "A2A agents written in Rust for maximum performance and memory safety." },
  kotlin: { label: "Kotlin", description: "A2A agents written in Kotlin for JVM and Android environments." },
};
