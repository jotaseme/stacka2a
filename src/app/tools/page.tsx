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
    icon: ValidatorIcon,
  },
  {
    href: "/tools/agent-discovery",
    title: "Agent Discovery",
    description:
      "Enter an agent URL and fetch its Agent Card from /.well-known/agent-card.json. See capabilities, skills, and metadata.",
    icon: DiscoveryIcon,
  },
  {
    href: "/tools/sdk-playground",
    title: "SDK Playground",
    description:
      "Generate connection code for any A2A agent in Python, TypeScript, Java, Go, or C#. Ready to copy and paste.",
    icon: PlaygroundIcon,
  },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">
          Developer
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          A2A Developer Tools
        </h1>
        <p className="mt-2 text-text-secondary">
          Free tools to build, validate, and connect A2A agents.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {tools.map((tool, i) => (
          <Link
            key={tool.href}
            href={tool.href}
            className={`card-hover group animate-fade-up stagger-${i + 1} flex items-start gap-4 rounded-2xl border border-border bg-surface-elevated p-6 transition-all hover:border-accent/30`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <tool.icon />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors">
                {tool.title}
              </h2>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                {tool.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ValidatorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function DiscoveryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PlaygroundIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
