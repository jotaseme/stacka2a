"use client";

import { useState, useMemo } from "react";
import type { A2AAgent } from "@/lib/types";
import { computeQualityScore } from "@/lib/quality-score";
import { AgentCard } from "./agent-card";

type SortOption = "quality" | "stars" | "updated" | "name";

const sortLabels: Record<SortOption, string> = {
  quality: "Quality score",
  stars: "Stars",
  updated: "Recently updated",
  name: "Name",
};

interface AgentListProps {
  agents: A2AAgent[];
  categories: string[];
  frameworks: string[];
  languages: string[];
}

export function AgentList({ agents, categories, frameworks, languages }: AgentListProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeFramework, setActiveFramework] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("quality");

  const filtered = useMemo(() => {
    let result = agents;
    if (activeCategory) {
      result = result.filter((a) => a.category === activeCategory);
    }
    if (activeFramework) {
      result = result.filter((a) => a.framework === activeFramework);
    }
    if (activeLanguage) {
      result = result.filter((a) => a.language === activeLanguage);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.provider.name.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "quality":
          return computeQualityScore(b).total - computeQualityScore(a).total;
        case "stars":
          return b.githubStars - a.githubStars;
        case "updated":
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    return result;
  }, [agents, search, activeCategory, activeFramework, activeLanguage, sortBy]);

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Sort */}
      <div className="flex flex-col gap-3 animate-fade-up stagger-1">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 transition-shadow"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 transition-shadow"
          >
            {Object.entries(sortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeCategory === null
                ? "bg-accent text-white shadow-sm"
                : "bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-accent/30"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-accent/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Framework filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-text-tertiary font-medium mr-1">Framework:</span>
          <button
            onClick={() => setActiveFramework(null)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              activeFramework === null
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            All
          </button>
          {frameworks.map((fw) => (
            <button
              key={fw}
              onClick={() => setActiveFramework(activeFramework === fw ? null : fw)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                activeFramework === fw
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {fw}
            </button>
          ))}
        </div>

        {/* Language filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-text-tertiary font-medium mr-1">Language:</span>
          <button
            onClick={() => setActiveLanguage(null)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              activeLanguage === null
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            All
          </button>
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveLanguage(activeLanguage === lang ? null : lang)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                activeLanguage === lang
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-text-tertiary">
        {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Results */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((agent) => (
          <AgentCard key={agent.slug} agent={agent} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-16 text-center text-text-secondary">
          No agents found matching your search.
        </p>
      )}
    </div>
  );
}
