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
