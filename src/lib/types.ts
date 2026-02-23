export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AgentProvider {
  name: string;
  url?: string;
}

export type AuthType = "none" | "api-key" | "oauth2" | "bearer" | "mtls" | "oidc";

export interface A2AAgent {
  slug: string;
  name: string;
  description: string;
  provider: AgentProvider;
  repository: string;
  category: string;
  tags: string[];
  framework: string;
  language: string;
  skills: AgentSkill[];
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    multiTurn: boolean;
  };
  authType: AuthType;
  agentCardUrl?: string;
  endpointUrl?: string;
  sdks: string[];
  githubStars: number;
  lastUpdated: string;
  official: boolean;
  selfHosted: boolean;
  license: string;
}

export type StackCategory = "use-case" | "framework" | "industry";

export interface Stack {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: StackCategory;
  agents: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  blogPost?: string;
  agentNotes?: Record<string, string>;
}

export type A2ASDK = "python" | "typescript" | "java" | "go" | "csharp";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingTime: number;
  tags: string[];
  relatedStacks?: string[];
  relatedAgents?: string[];
}
