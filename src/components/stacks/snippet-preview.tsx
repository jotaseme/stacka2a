"use client";

import { useState } from "react";
import type { A2AAgent, A2ASDK } from "@/lib/types";
import { generateSnippet, getSnippetLanguage, getInstallCommand } from "@/lib/snippet-generator";

const sdks: { id: A2ASDK; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "typescript", label: "TypeScript" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "csharp", label: "C#" },
];

interface SnippetPreviewProps {
  agent: A2AAgent;
}

export function SnippetPreview({ agent }: SnippetPreviewProps) {
  const [activeSdk, setActiveSdk] = useState<A2ASDK>("python");
  const [copied, setCopied] = useState(false);

  const snippet = generateSnippet(agent, activeSdk);
  const install = getInstallCommand(activeSdk);
  const language = getSnippetLanguage(activeSdk);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* SDK Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface border border-border p-1">
        {sdks.map((sdk) => (
          <button
            key={sdk.id}
            onClick={() => setActiveSdk(sdk.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeSdk === sdk.id
                ? "bg-surface-elevated text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {sdk.label}
          </button>
        ))}
      </div>

      {/* Install command */}
      <div className="rounded-xl bg-surface border border-border px-4 py-2.5 font-mono text-sm text-text-secondary">
        <span className="text-accent select-none">$ </span>
        {install}
      </div>

      {/* Code snippet */}
      <div className="relative rounded-xl bg-code-bg border border-[#2a2a3e] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2a2a3e] px-4 py-2">
          <span className="text-xs text-code-text/40 font-mono">{language}</span>
          <button
            onClick={handleCopy}
            className="text-xs text-code-text/40 hover:text-code-text transition-colors font-medium"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-code-text font-mono">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  );
}
