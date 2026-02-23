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
  const frameworkCommands: Record<string, string> = {
    "spring-boot": "mvn spring-boot:run",
    django: "python manage.py runserver",
    fastapi: "uvicorn main:app --reload",
    flask: "python app.py",
  };
  if (frameworkCommands[framework]) return frameworkCommands[framework];

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
