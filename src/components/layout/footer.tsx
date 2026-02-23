import Link from "next/link";
import { Brand } from "@/components/ui/brand";

const footerLinks = [
  { href: "/stacks", label: "Stacks" },
  { href: "/agents", label: "Agents" },
  { href: "/compare", label: "Compare" },
  { href: "/tools", label: "Tools" },
  { href: "/blog", label: "Blog" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
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
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-text-secondary">
            &copy; {new Date().getFullYear()} <Brand />
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            350+ A2A agents indexed
          </span>
        </div>
      </div>
    </footer>
  );
}
