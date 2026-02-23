"use client";

import { useState } from "react";
import type { A2AAgent } from "@/lib/types";
import { generateGettingStarted } from "@/lib/getting-started";

interface StackSnippetSectionProps {
  agents: A2AAgent[];
}

export function StackSnippetSection({ agents }: StackSnippetSectionProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = agents[selectedIndex];
  const steps = generateGettingStarted(selected);

  return (
    <div className="flex flex-col gap-3">
      {/* Agent selector */}
      {agents.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {agents.map((agent, i) => (
            <button
              key={agent.slug}
              onClick={() => setSelectedIndex(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                i === selectedIndex
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-accent/30"
              }`}
            >
              {agent.name}
            </button>
          ))}
        </div>
      )}

      {/* Getting Started steps */}
      <div className="flex flex-col gap-2">
        <StepBlock step={1} label="Clone the repository" command={steps.clone} />
        <StepBlock step={2} label="Navigate to the project" command={steps.navigate} />
        <StepBlock step={3} label="Install dependencies" command={steps.install} />
        <StepBlock step={4} label="Run the agent" command={steps.run} />
      </div>
      {steps.hostedEndpoint && (
        <p className="text-sm text-text-secondary mt-1">
          Or connect to the hosted endpoint:{" "}
          <a
            href={steps.hostedEndpoint}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover underline underline-offset-2"
          >
            {steps.hostedEndpoint}
          </a>
        </p>
      )}
    </div>
  );
}

function StepBlock({ step, label, command }: { step: number; label: string; command: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
          {step}
        </span>
        <span className="text-sm font-medium text-text-primary">{label}</span>
      </div>
      <div className="rounded-lg bg-code-bg px-3 py-2 font-mono text-sm text-code-text">
        <span className="text-accent select-none">$ </span>
        {command}
      </div>
    </div>
  );
}
