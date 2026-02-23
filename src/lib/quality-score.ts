import type { A2AAgent } from "./types";

export interface QualityBreakdown {
  stars: number;
  freshness: number;
  official: number;
  skillMaturity: number;
  protocolCompliance: number;
  authSecurity: number;
  total: number;
}

function logNorm(value: number, median: number, max: number): number {
  if (value <= 0) return 0;
  const capped = Math.min(value, max);
  return Math.min(100, (Math.log(capped + 1) / Math.log(max + 1)) * 100);
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function freshnessScore(lastUpdated: string): number {
  const days = daysSince(lastUpdated);
  if (days <= 7) return 100;
  if (days <= 30) return 90 - ((days - 7) / 23) * 10;
  if (days <= 90) return 80 - ((days - 30) / 60) * 30;
  if (days <= 180) return 50 - ((days - 90) / 90) * 30;
  if (days <= 365) return 20 - ((days - 180) / 185) * 10;
  return 10;
}

function skillMaturityScore(agent: A2AAgent): number {
  if (agent.skills.length === 0) return 10;
  let score = Math.min(40, agent.skills.length * 10);
  const documented = agent.skills.filter(
    (s) => s.description && s.description.length > 20 && s.tags.length > 0
  );
  score += (documented.length / agent.skills.length) * 60;
  return Math.min(100, Math.round(score));
}

function protocolComplianceScore(agent: A2AAgent): number {
  let score = 30;
  if (agent.agentCardUrl) score += 30;
  if (agent.capabilities.streaming) score += 15;
  if (agent.capabilities.multiTurn) score += 15;
  if (agent.endpointUrl) score += 10;
  return Math.min(100, score);
}

function authSecurityScore(agent: A2AAgent): number {
  switch (agent.authType) {
    case "oauth2":
      return 100;
    case "oidc":
      return 95;
    case "mtls":
      return 90;
    case "bearer":
      return 70;
    case "api-key":
      return 50;
    case "none":
      return 20;
    default:
      return 30;
  }
}

const WEIGHTS = {
  stars: 0.15,
  freshness: 0.25,
  official: 0.15,
  skillMaturity: 0.15,
  protocolCompliance: 0.15,
  authSecurity: 0.15,
};

export function computeQualityScore(agent: A2AAgent): QualityBreakdown {
  const stars = logNorm(agent.githubStars, 500, 30000);
  const freshness = freshnessScore(agent.lastUpdated);
  const official = agent.official ? 100 : 30;
  const skillMaturity = skillMaturityScore(agent);
  const protocolCompliance = protocolComplianceScore(agent);
  const authSecurity = authSecurityScore(agent);

  const total = Math.round(
    stars * WEIGHTS.stars +
      freshness * WEIGHTS.freshness +
      official * WEIGHTS.official +
      skillMaturity * WEIGHTS.skillMaturity +
      protocolCompliance * WEIGHTS.protocolCompliance +
      authSecurity * WEIGHTS.authSecurity
  );

  return {
    stars: Math.round(stars),
    freshness: Math.round(freshness),
    official: Math.round(official),
    skillMaturity: Math.round(skillMaturity),
    protocolCompliance: Math.round(protocolCompliance),
    authSecurity: Math.round(authSecurity),
    total: Math.min(100, Math.max(0, total)),
  };
}

export type ScoreLevel = "excellent" | "good" | "fair" | "poor";

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 70) return "excellent";
  if (score >= 50) return "good";
  if (score >= 30) return "fair";
  return "poor";
}

export function getScoreColor(level: ScoreLevel): string {
  switch (level) {
    case "excellent":
      return "text-green-600";
    case "good":
      return "text-yellow-600";
    case "fair":
      return "text-orange-500";
    case "poor":
      return "text-red-500";
  }
}

export function getScoreRingColor(level: ScoreLevel): string {
  switch (level) {
    case "excellent":
      return "stroke-green-500";
    case "good":
      return "stroke-yellow-500";
    case "fair":
      return "stroke-orange-500";
    case "poor":
      return "stroke-red-500";
  }
}

export function getScoreBgColor(level: ScoreLevel): string {
  switch (level) {
    case "excellent":
      return "bg-green-50";
    case "good":
      return "bg-yellow-50";
    case "fair":
      return "bg-orange-50";
    case "poor":
      return "bg-red-50";
  }
}

export function getMaintenanceStatus(lastUpdated: string): {
  label: string;
  color: string;
} {
  const days = daysSince(lastUpdated);
  if (days <= 30)
    return { label: "Actively maintained", color: "text-green-600" };
  if (days <= 90) return { label: "Maintained", color: "text-yellow-600" };
  if (days <= 180) return { label: "Stale", color: "text-orange-500" };
  return { label: "Abandoned", color: "text-red-500" };
}
