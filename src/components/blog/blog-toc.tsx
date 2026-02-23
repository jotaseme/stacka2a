"use client";

import { useState, useEffect, useCallback } from "react";

interface Heading {
  id: string;
  text: string;
}

interface BlogTocProps {
  headings: Heading[];
}

export function BlogToc({ headings }: BlogTocProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible.length > 0) {
      setActiveId(visible[0].target.id);
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0,
    });

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings, handleObserver]);

  if (headings.length < 3) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden xl:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 scrollbar-none">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">
          On this page
        </p>
        <ul className="flex flex-col gap-0.5 border-l border-border">
          {headings.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={() => setActiveId(h.id)}
                className={`block py-1.5 pl-4 text-[13px] leading-snug transition-colors border-l-2 -ml-px ${
                  activeId === h.id
                    ? "border-accent text-accent font-medium"
                    : "border-transparent text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile popover trigger */}
      <div className="xl:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-elevated shadow-lg transition-all hover:shadow-xl hover:border-accent/30"
          aria-label="Table of contents"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-secondary"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="15" y2="12" />
            <line x1="3" y1="18" x2="9" y2="18" />
          </svg>
        </button>

        {/* Mobile popover */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute bottom-14 right-0 z-50 w-64 rounded-xl border border-border bg-surface-elevated p-4 shadow-xl animate-fade-up">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">
                On this page
              </p>
              <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a
                      href={`#${h.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`block py-1.5 text-sm transition-colors ${
                        activeId === h.id
                          ? "text-accent font-medium"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}
