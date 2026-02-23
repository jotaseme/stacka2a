"use client";

import { useState } from "react";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

const EXAMPLE_CARD = JSON.stringify(
  {
    name: "My Agent",
    description: "A helpful assistant agent",
    version: "1.0.0",
    url: "https://my-agent.example.com",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: [
      {
        id: "analyze-data",
        name: "Analyze Data",
        description: "Analyzes CSV and JSON datasets",
        tags: ["data", "analytics"],
      },
    ],
  },
  null,
  2
);

function validateAgentCard(input: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // Parse JSON
  let card: Record<string, unknown>;
  try {
    card = JSON.parse(input);
  } catch {
    return {
      valid: false,
      errors: ["Invalid JSON: " + (input.trim() === "" ? "empty input" : "syntax error")],
      warnings: [],
      info: [],
    };
  }

  if (typeof card !== "object" || card === null || Array.isArray(card)) {
    return { valid: false, errors: ["Root must be a JSON object"], warnings: [], info: [] };
  }

  // Required fields
  const requiredStrings = ["name", "description", "url"];
  for (const field of requiredStrings) {
    if (!card[field]) {
      errors.push(`Missing required field: "${field}"`);
    } else if (typeof card[field] !== "string") {
      errors.push(`"${field}" must be a string`);
    }
  }

  // URL validation
  if (typeof card.url === "string") {
    try {
      const url = new URL(card.url);
      if (url.protocol !== "https:") {
        warnings.push(`"url" uses HTTP — HTTPS is strongly recommended for production`);
      }
      info.push(`Agent endpoint: ${card.url}`);
    } catch {
      errors.push(`"url" is not a valid URL`);
    }
  }

  // Version
  if (card.version) {
    if (typeof card.version !== "string") {
      errors.push(`"version" must be a string`);
    } else {
      info.push(`Version: ${card.version}`);
    }
  } else {
    warnings.push(`Missing "version" — recommended for client compatibility`);
  }

  // Capabilities
  if (card.capabilities) {
    if (typeof card.capabilities !== "object" || Array.isArray(card.capabilities)) {
      errors.push(`"capabilities" must be an object`);
    } else {
      const caps = card.capabilities as Record<string, unknown>;
      const boolFields = ["streaming", "pushNotifications", "stateTransitionHistory"];
      for (const field of boolFields) {
        if (field in caps && typeof caps[field] !== "boolean") {
          warnings.push(`"capabilities.${field}" should be a boolean`);
        }
      }
      const enabled = boolFields.filter((f) => caps[f] === true);
      if (enabled.length > 0) {
        info.push(`Capabilities: ${enabled.join(", ")}`);
      }
    }
  } else {
    warnings.push(`Missing "capabilities" — clients won't know what your agent supports`);
  }

  // Skills
  if (card.skills) {
    if (!Array.isArray(card.skills)) {
      errors.push(`"skills" must be an array`);
    } else {
      const skills = card.skills as Record<string, unknown>[];
      if (skills.length === 0) {
        warnings.push(`"skills" is empty — agents should advertise at least one skill`);
      }
      for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        if (!skill.id) warnings.push(`skills[${i}] missing "id"`);
        if (!skill.name) warnings.push(`skills[${i}] missing "name"`);
        if (!skill.description) warnings.push(`skills[${i}] missing "description" — helps with discovery`);
      }
      info.push(`Skills count: ${skills.length}`);
    }
  } else {
    warnings.push(`Missing "skills" — agents should advertise their capabilities`);
  }

  // Provider
  if (card.provider) {
    const provider = card.provider as Record<string, unknown>;
    if (!provider.organization) {
      warnings.push(`"provider.organization" is recommended`);
    }
  }

  // Security schemes
  if (card.securitySchemes) {
    info.push(`Security schemes defined`);
  } else {
    warnings.push(`No "securitySchemes" — consider adding authentication for production`);
  }

  return { valid: errors.length === 0, errors, warnings, info };
}

export function AgentCardValidatorTool() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);

  const handleValidate = () => {
    setResult(validateAgentCard(input));
  };

  const handleLoadExample = () => {
    setInput(EXAMPLE_CARD);
    setResult(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">
          Paste your Agent Card JSON
        </label>
        <button
          onClick={handleLoadExample}
          className="text-xs text-accent hover:underline"
        >
          Load example
        </button>
      </div>

      <textarea
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setResult(null);
        }}
        placeholder='{"name": "My Agent", "description": "...", "url": "https://..."}'
        className="h-72 w-full resize-y rounded-xl border border-border bg-code-bg p-4 font-mono text-sm text-code-text focus:border-accent focus:outline-none"
        spellCheck={false}
      />

      <button
        onClick={handleValidate}
        disabled={!input.trim()}
        className="w-full rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Validate Agent Card
      </button>

      {result && (
        <div className="flex flex-col gap-4 rounded-xl border border-border p-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex size-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                result.valid ? "bg-emerald-500" : "bg-red-500"
              }`}
            >
              {result.valid ? "\u2713" : "\u2717"}
            </span>
            <span className="text-lg font-semibold text-text-primary">
              {result.valid ? "Valid Agent Card" : "Invalid Agent Card"}
            </span>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-red-600">
                Errors ({result.errors.length})
              </h3>
              {result.errors.map((e, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
                >
                  {e}
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-amber-600">
                Warnings ({result.warnings.length})
              </h3>
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700"
                >
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          {result.info.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-blue-600">
                Info ({result.info.length})
              </h3>
              {result.info.map((inf, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700"
                >
                  {inf}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
