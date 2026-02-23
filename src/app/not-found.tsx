import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  description:
    "The page you are looking for does not exist. Browse A2A agents, curated stacks, or read our guides.",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-24 text-center">
      <p className="text-6xl font-bold text-accent">404</p>
      <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
        Page not found
      </h1>
      <p className="text-text-secondary leading-relaxed">
        The page you are looking for doesn&apos;t exist or has been moved.
        Try one of these instead:
      </p>
      <nav className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
        >
          Home
        </Link>
        <Link
          href="/agents"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
        >
          Browse Agents
        </Link>
        <Link
          href="/stacks"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
        >
          Stacks
        </Link>
        <Link
          href="/blog"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft"
        >
          Blog
        </Link>
      </nav>
    </div>
  );
}
