"use client";

import { useState } from "react";

interface DiscoveryResult {
  status: "success" | "error";
  url: string;
  data?: Record<string, unknown>;
  error?: string;
  responseTime?: number;
}

export function AgentDiscoveryTool() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);

  const handleDiscover = async () => {
    setLoading(true);
    setResult(null);

    let baseUrl = url.trim();
    if (!baseUrl.startsWith("http")) {
      baseUrl = "https://" + baseUrl;
    }
    // Remove trailing slash
    baseUrl = baseUrl.replace(/\/+$/, "");

    const cardUrl = baseUrl.includes("/.well-known/agent-card.json")
      ? baseUrl
      : `${baseUrl}/.well-known/agent-card.json`;

    const start = performance.now();

    try {
      const resp = await fetch("/api/discover-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cardUrl }),
      });

      const responseTime = Math.round(performance.now() - start);

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setResult({
          status: "error",
          url: cardUrl,
          error: body.error || `HTTP ${resp.status}`,
          responseTime,
        });
        return;
      }

      const data = await resp.json();
      setResult({
        status: "success",
        url: cardUrl,
        data,
        responseTime,
      });
    } catch (err) {
      setResult({
        status: "error",
        url: cardUrl,
        error: err instanceof Error ? err.message : "Network error",
        responseTime: Math.round(performance.now() - start),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text-primary">
          Agent URL or base domain
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
            placeholder="agent.example.com"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
          />
          <button
            onClick={handleDiscover}
            disabled={!url.trim() || loading}
            className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Fetching..." : "Discover"}
          </button>
        </div>
        <p className="text-xs text-text-secondary">
          We&apos;ll fetch <code className="rounded bg-surface px-1 py-0.5">/.well-known/agent-card.json</code> from this URL
        </p>
      </div>

      {result && (
        <div className="flex flex-col gap-4">
          {/* Status bar */}
          <div className="flex items-center gap-3 rounded-xl border border-border p-4">
            <span
              className={`inline-flex size-3 rounded-full ${
                result.status === "success" ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium text-text-primary">
              {result.status === "success"
                ? "Agent Card found"
                : "Could not fetch Agent Card"}
            </span>
            {result.responseTime && (
              <span className="ml-auto text-xs text-text-secondary">
                {result.responseTime}ms
              </span>
            )}
          </div>

          {/* Error */}
          {result.error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {result.error}
            </div>
          )}

          {/* Agent Card data */}
          {result.data && (
            <div className="flex flex-col gap-4">
              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard
                  label="Name"
                  value={String(result.data.name || "—")}
                />
                <InfoCard
                  label="Version"
                  value={String(result.data.version || "—")}
                />
                <InfoCard
                  label="URL"
                  value={String(result.data.url || "—")}
                />
                <InfoCard
                  label="Skills"
                  value={
                    Array.isArray(result.data.skills)
                      ? `${result.data.skills.length} skills`
                      : "None"
                  }
                />
              </div>

              {/* Raw JSON */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-text-primary">
                  Raw Agent Card
                </h3>
                <pre className="max-h-96 overflow-auto rounded-xl bg-code-bg border border-[#2a2a2a] p-4 text-sm text-code-text font-mono">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <p className="text-xs text-text-secondary">
            Fetched from:{" "}
            <code className="rounded bg-surface px-1 py-0.5">{result.url}</code>
          </p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-text-primary">
        {value}
      </p>
    </div>
  );
}
