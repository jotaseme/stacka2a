import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "A2A Tools — StackA2A",
  description:
    "Free tools for A2A agent development: validate Agent Cards, discover agents, and generate SDK connection code.",
  alternates: { canonical: "https://stacka2a.dev/tools" },
};

const tools = [
  {
    href: "/tools/agent-card-validator",
    title: "Agent Card Validator",
    description:
      "Paste your Agent Card JSON and validate it against the A2A specification. Get errors, warnings, and improvement suggestions.",
    icon: "\u2705",
  },
  {
    href: "/tools/agent-discovery",
    title: "Agent Discovery",
    description:
      "Enter an agent URL and fetch its Agent Card from /.well-known/agent-card.json. See capabilities, skills, and metadata.",
    icon: "\uD83D\uDD0D",
  },
  {
    href: "/tools/sdk-playground",
    title: "SDK Playground",
    description:
      "Generate connection code for any A2A agent in Python, TypeScript, Java, Go, or C#. Ready to copy and paste.",
    icon: "\uD83D\uDCBB",
  },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary">
        A2A Developer Tools
      </h1>
      <p className="mt-2 text-text-secondary">
        Free tools to build, validate, and connect A2A agents.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex items-start gap-4 rounded-xl border border-border p-6 transition-all hover:border-accent/30 hover:bg-accent-soft"
          >
            <span className="text-2xl">{tool.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-text-primary group-hover:text-accent">
                {tool.title}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {tool.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
