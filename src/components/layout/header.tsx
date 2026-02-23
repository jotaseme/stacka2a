"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import icon from "@/app/icon.png";
import { Brand } from "@/components/ui/brand";

const navItems = [
  { href: "/stacks", label: "Stacks" },
  { href: "/agents", label: "Agents" },
  { href: "/compare", label: "Compare" },
  { href: "/tools", label: "Tools" },
  { href: "/learn", label: "Learn" },
  { href: "/blog", label: "Blog" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-text-primary"
        >
          <Image src={icon} alt="" width={28} height={28} priority className="size-7" />
          <Brand />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 sm:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface hover:text-text-primary sm:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            {open ? (
              <>
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </>
            ) : (
              <>
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-border/60 bg-background/95 backdrop-blur-xl px-6 pb-4 pt-2 sm:hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-accent bg-accent-soft"
                    : "text-text-secondary hover:bg-surface hover:text-text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
