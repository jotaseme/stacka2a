import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdown";

describe("markdownToHtml", () => {
  it("renders basic markdown", async () => {
    const html = await markdownToHtml("# Hello\n\nWorld");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
    expect(html).toContain("<p>World</p>");
  });

  it("renders GFM tables", async () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const html = await markdownToHtml(md);
    expect(html).toContain("<table>");
  });

  it("renders code blocks with highlight", async () => {
    const md = "```python\nprint('hi')\n```";
    const html = await markdownToHtml(md);
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
  });

  it("returns empty string for empty input", async () => {
    const html = await markdownToHtml("");
    expect(html).toBe("");
  });
});
