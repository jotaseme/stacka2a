import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const metadata: Metadata = {
  title: "FAQ — A2A Protocol & StackA2A",
  description:
    "Frequently asked questions about the A2A protocol, Agent Cards, SDKs, and the StackA2A directory.",
  alternates: { canonical: "https://stacka2a.dev/faq" },
};

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSection {
  title: string;
  items: FaqItem[];
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "A2A Protocol",
    items: [
      {
        question: "What is the A2A protocol?",
        answer:
          "A2A (Agent-to-Agent) is an open protocol created by Google that lets AI agents communicate with each other regardless of framework or language. It defines a standard for agent discovery via Agent Cards, task execution via JSON-RPC, and streaming via Server-Sent Events. Think of it as HTTP for agents — a common language that makes any agent interoperable with any other.",
      },
      {
        question: "How do A2A agents find each other?",
        answer:
          'Every A2A agent serves an Agent Card — a JSON document at <code>/.well-known/agent-card.json</code>. The card describes the agent\'s name, skills, input/output formats, and authentication requirements. A client agent discovers another agent by fetching its card, evaluating the skills, and then sending tasks to the endpoint listed in the card. Check our <a href="/learn/agent-card-spec">Agent Card spec guide</a> for the full breakdown.',
      },
      {
        question: "What is an Agent Card?",
        answer:
          'An Agent Card is a machine-readable JSON document that acts as an agent\'s resume. It includes the agent\'s name, description, version, skills, capabilities (streaming, push notifications), supported MIME types, and authentication schemes. Clients use it for discovery and routing. See our <a href="/blog/a2a-agent-card-explained">deep dive on Agent Cards</a>.',
      },
      {
        question: "What is the difference between A2A and MCP?",
        answer:
          'A2A handles agent-to-agent communication — agents talking to other agents. MCP (Model Context Protocol) handles model-to-tool communication — an LLM calling external tools like databases or APIs. They\'re complementary, not competing. An A2A agent can use MCP internally to access tools while exposing its capabilities via A2A externally. We covered this in detail in our <a href="/blog/a2a-vs-mcp-comparison">A2A vs MCP comparison</a>.',
      },
      {
        question: "Is A2A open source?",
        answer:
          "Yes. The A2A specification is maintained by the Linux Foundation and the reference implementations are open source on GitHub. Google created it, but it's governed as an open standard with contributions from multiple organizations.",
      },
    ],
  },
  {
    title: "StackA2A",
    items: [
      {
        question: "What is StackA2A?",
        answer:
          'StackA2A is a curated directory of A2A protocol agents. We index agents from GitHub, registries, and direct submissions, then score each one across six dimensions: GitHub stars, freshness, official status, skill maturity, protocol compliance, and authentication security. The result is a quality-scored, searchable directory with connection code snippets for Python, TypeScript, Java, Go, and C#. Browse the full directory at <a href="/agents">/agents</a>.',
      },
      {
        question: "How are quality scores calculated?",
        answer:
          "Each agent is scored across six weighted dimensions: GitHub stars (15%), freshness based on last update (25%), official vs community status (15%), skill maturity — number and documentation of skills (15%), protocol compliance — Agent Card, streaming, multi-turn support (15%), and authentication security — OAuth2 scores higher than API keys (15%). The total produces a score from 0 to 100.",
      },
      {
        question: "How often is the directory updated?",
        answer:
          "We run discovery sweeps weekly to pick up new agents and re-score existing ones. Agent data like GitHub stars and last-updated dates are refreshed during each sweep. If you've published a new agent and want it indexed faster, use our <a href=\"/submit-agent\">submit form</a>.",
      },
      {
        question: "How do I submit my agent?",
        answer:
          'Head to <a href="/submit-agent">/submit-agent</a> and fill out the form with your repository URL, Agent Card URL (if live), category, framework, and a description. We review submissions within 48 hours. Once approved, your agent gets quality-scored and listed in the directory.',
      },
      {
        question: "What are Stacks?",
        answer:
          'Stacks are curated collections of A2A agents that work well together for a specific use case. For example, the <a href="/stacks/code-generation">Code Generation stack</a> groups the best code-writing agents. Each stack includes architecture context and connection snippets so you can wire agents together quickly.',
      },
    ],
  },
  {
    title: "Technical",
    items: [
      {
        question: "Which SDKs support A2A?",
        answer:
          'Google maintains official SDKs for Python and TypeScript/JavaScript. Community SDKs exist for Java (Spring Boot), Go, and C#. The Python SDK is the most mature, with full support for streaming, push notifications, and extended Agent Cards. See our <a href="/learn/sdks-by-language">SDK guide by language</a> for installation and usage.',
      },
      {
        question: "How does A2A streaming work?",
        answer:
          "A2A streaming uses Server-Sent Events (SSE). When a client calls <code>message/stream</code> instead of <code>message/send</code>, the agent sends back a series of SSE events, each containing a partial task update with incremental artifacts. The client can display results as they arrive. The agent must declare <code>streaming: true</code> in its Agent Card capabilities.",
      },
      {
        question: "Does A2A support multi-turn conversations?",
        answer:
          "Yes. A2A tasks can have multiple turns. After the agent responds, the client can send follow-up messages referencing the same task ID. The agent maintains conversation state across turns. This enables clarification flows, iterative refinement, and back-and-forth negotiation between agents.",
      },
      {
        question: "How does authentication work in A2A?",
        answer:
          'A2A uses the OpenAPI security scheme pattern. Agent Cards declare their authentication requirements in <code>securitySchemes</code> — supporting API keys, Bearer tokens (JWT), OAuth2 (client credentials, authorization code), OpenID Connect, and mutual TLS. Clients read the card and authenticate accordingly before sending tasks. Our <a href="/learn/security-guide">security guide</a> covers implementation details.',
      },
      {
        question: "Can I use A2A with LangChain, CrewAI, or AutoGen?",
        answer:
          'Yes. A2A is framework-agnostic. Google ADK has native <code>to_a2a()</code> support. LangGraph agents can be wrapped with the A2A Python SDK. CrewAI and AutoGen agents need a thin adapter layer that maps their input/output to A2A\'s JSON-RPC format. Browse agents by framework: <a href="/agents/framework/google-adk">Google ADK</a>, <a href="/agents/framework/langgraph">LangGraph</a>, <a href="/agents/framework/crewai">CrewAI</a>, <a href="/agents/framework/autogen">AutoGen</a>.',
      },
    ],
  },
];

const allFaqItems = FAQ_SECTIONS.flatMap((s) => s.items);

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer.replace(/<[^>]*>/g, ""),
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "FAQ" }]} />

        <div className="flex flex-col gap-2 mb-12 animate-fade-up">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Questions
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="text-text-secondary">
            Everything you need to know about A2A and StackA2A.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {FAQ_SECTIONS.map((section, si) => (
            <section
              key={section.title}
              className={`animate-fade-up stagger-${si + 1}`}
            >
              <h2 className="text-lg font-semibold text-text-primary mb-4 pb-2 border-b border-border">
                {section.title}
              </h2>
              <div className="flex flex-col gap-2">
                {section.items.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-xl border border-border bg-surface-elevated transition-colors hover:border-accent/20"
                  >
                    <summary className="cursor-pointer select-none px-5 py-4 text-sm font-medium text-text-primary flex items-center justify-between gap-4">
                      {item.question}
                      <svg
                        className="size-4 shrink-0 text-text-tertiary transition-transform group-open:rotate-180"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </summary>
                    <div
                      className="px-5 pb-4 text-sm text-text-secondary leading-relaxed [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono"
                      dangerouslySetInnerHTML={{ __html: item.answer }}
                    />
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-surface-elevated p-8 text-center animate-fade-up">
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Still have questions?
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            Check our guides for in-depth coverage, or submit your agent to get listed.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/learn"
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
            >
              Learn A2A
            </Link>
            <Link
              href="/submit-agent"
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
            >
              Submit Agent
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
