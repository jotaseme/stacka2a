import type { Metadata } from "next";
import Link from "next/link";
import { getAllLearnGuides } from "@/lib/learn";

export const metadata: Metadata = {
  title: "Learn A2A Protocol",
  description:
    "Comprehensive guides to the A2A protocol: fundamentals, Agent Cards, SDKs, and security. From zero to production.",
  alternates: { canonical: "https://stacka2a.dev/learn" },
};

const ICONS: Record<string, React.FC> = {
  book: BookIcon,
  card: CardIcon,
  code: CodeIcon,
  shield: ShieldIcon,
};

export default function LearnPage() {
  const guides = getAllLearnGuides();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-12 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">
          Guides
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Learn A2A
        </h1>
        <p className="mt-2 text-text-secondary">
          Everything you need to understand and build with the A2A protocol.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map((guide, i) => {
          const Icon = ICONS[guide.icon] || ICONS.book;
          return (
            <Link
              key={guide.slug}
              href={`/learn/${guide.slug}`}
              className={`card-hover group animate-fade-up stagger-${i + 1} flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-6 transition-all hover:border-accent/30`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Icon />
              </span>
              <h2 className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors">
                {guide.title}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                {guide.description}
              </p>
              <span className="text-xs text-text-tertiary">
                {guide.readingTime} min read
              </span>
            </Link>
          );
        })}
      </div>

      {guides.length === 0 && (
        <p className="py-12 text-center text-text-secondary">
          Guides coming soon. Check back shortly.
        </p>
      )}
    </div>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}
