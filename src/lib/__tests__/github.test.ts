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
