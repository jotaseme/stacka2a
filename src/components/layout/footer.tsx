import Link from "next/link";
import { Brand } from "@/components/ui/brand";

const footerLinks = [
  { href: "/stacks", label: "Stacks" },
  { href: "/agents", label: "Agents" },
  { href: "/compare", label: "Compare" },
  { href: "/tools", label: "Tools" },
  { href: "/learn", label: "Learn" },
  { href: "/blog", label: "Blog" },
  { href: "/submit-agent", label: "Submit Agent" },
  { href: "/faq", label: "FAQ" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Brand />
            <p className="text-xs text-text-tertiary max-w-xs">
              Curated directory of A2A protocol agents with quality scores and connection snippets.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border-subtle pt-6 sm:flex-row">
          <p className="text-xs text-text-tertiary">
            &copy; {new Date().getFullYear()} StackA2A
          </p>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium text-text-secondary">
            <span className="glow-dot" />
            250+ A2A agents indexed
          </span>
        </div>
      </div>
    </footer>
  );
}
