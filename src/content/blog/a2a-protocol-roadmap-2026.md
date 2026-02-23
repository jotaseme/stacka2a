---
title: "A2A Protocol Roadmap: What's Coming in 2026"
description: "Analysis of A2A protocol evolution: what's shipped, what's next on the spec, ecosystem predictions, and opinionated takes on what matters most for agent interoperability."
date: "2026-04-03"
readingTime: 8
tags: ["a2a", "roadmap", "ecosystem", "predictions"]
relatedStacks: []
relatedAgents: []
---

The A2A protocol launched in April 2025. In under a year, it went from a Google research project to an open spec with implementations in Python, TypeScript, Java, Go, and C#. CrewAI and LangGraph both ship native support. The ecosystem has real agents doing real work. But the protocol is still young, and the gaps are visible.

Here is what has shipped, what the spec is working on, and where I think the ecosystem goes next.

## What Has Shipped

The core protocol is stable and covers the fundamentals:

**Agent Cards** -- JSON metadata at `/.well-known/agent-card.json` for discovery. Skills, capabilities, security schemes. This is the foundation everything else builds on. See [Agent Cards Explained](/blog/a2a-agent-card-explained) for the full breakdown.

**JSON-RPC messaging** -- `message/send` for synchronous tasks, `message/stream` for SSE streaming. Task lifecycle with states: `submitted`, `working`, `input-required`, `completed`, `failed`, `canceled`.

**Multi-turn conversations** -- `contextId` and `taskId` carry state across turns. Agents can ask for clarification, request approval, and maintain conversation history.

**Push notifications** -- Webhook-based callbacks for long-running tasks. The agent calls your webhook when the task completes instead of requiring you to poll.

**Security schemes** -- OAuth2, API keys, Bearer tokens, mTLS, OpenID Connect. Declared in the Agent Card so clients know how to authenticate before connecting.

**Artifacts** -- Structured output beyond text. Agents can return files, images, JSON data, and other typed content.

**Official SDKs** -- Python and JavaScript/TypeScript SDKs from the A2A project. Community SDKs for Java, Go, C#, Kotlin.

This is enough to build production agent systems. People are doing it. But production use exposes the gaps.

## What the Spec Is Working On

These are areas under active discussion in the A2A spec working group. Not all will ship. Some will change form. But they represent the real pain points.

### Improved Authentication

The current auth model works for simple scenarios: one agent calls another, presents a token, done. It breaks down in multi-agent chains.

**The problem:** Agent A calls Agent B, which calls Agent C. Agent C needs to know that Agent A authorized the chain. OAuth2 client credentials give Agent B its own identity, but say nothing about Agent A's original request. Token propagation, delegation, and on-behalf-of flows are not standardized.

**What is being discussed:**

- Token delegation patterns (RFC 8693 token exchange for A2A)
- Chain-of-trust headers so downstream agents can verify the full call chain
- Standardized scope hierarchies for common agent operations

This is the single most important gap for enterprise adoption. Without it, every organization builds ad-hoc trust propagation, and interoperability stops at the organization boundary.

### Agent Marketplaces and Registries

Right now, discovering an agent requires knowing its URL. That works within an organization. It does not work across organizations.

**What is being discussed:**

- Standardized registry API for publishing and querying Agent Cards
- Trust and reputation signals (verified publishers, usage metrics)
- Categorized skill taxonomies so you can search "find me a code review agent"
- Federated registries where organizations publish their agents to a shared directory

```json
{
  "registry": "https://registry.a2aproject.org",
  "query": {
    "skills": ["code-review"],
    "capabilities": { "streaming": true },
    "trust_level": "verified",
    "min_version": "1.0.0"
  },
  "results": [
    {
      "agent_card_url": "https://code-review.example.com/.well-known/agent-card.json",
      "publisher": "DevTools Inc.",
      "verified": true,
      "usage_count": 45000,
      "avg_latency_ms": 3200
    }
  ]
}
```

This is the equivalent of npm for agents. It will happen. The question is whether the spec standardizes it or the market fragments into competing proprietary registries. I think we get 2-3 major registries by end of 2026 and a standardized query API by mid-2027.

### Standardized Skill Taxonomies

Every agent defines its own skill IDs and descriptions. There is no shared vocabulary. One agent's `code-review` is another's `review-code` is another's `static-analysis`. An orchestrator that needs to find a code review agent has to read natural-language descriptions and hope the LLM parses them correctly.

**What is being discussed:**

- A shared taxonomy of common skill categories
- Standardized skill IDs for common operations (like HTTP methods, but for agent capabilities)
- Skill compatibility declarations ("this skill is equivalent to taxonomy:code-review/v1")

```json
{
  "skills": [
    {
      "id": "code-review",
      "name": "Code Review",
      "taxonomy": "a2a:security/code-review@1.0",
      "description": "Reviews code for security vulnerabilities",
      "compatibleWith": ["a2a:security/sast@1.0"]
    }
  ]
}
```

This matters for agent interchangeability. If two agents declare the same taxonomy skill, a coordinator can substitute one for the other. Without it, every agent is a snowflake.

### Enterprise Features

Production teams are asking for features the spec does not address yet:

**Rate limiting signals** -- Agents should be able to declare their rate limits in the Agent Card so clients can implement backpressure without trial and error.

```json
{
  "rateLimits": {
    "requestsPerMinute": 60,
    "concurrentTasks": 10,
    "maxInputSize": "1MB"
  }
}
```

**SLA declarations** -- Expected latency, uptime guarantees, maximum task duration. Useful for orchestrators that need to plan around agent performance.

**Billing and metering** -- Standardized usage reporting so agents can charge per task, per token, or per minute. Without this, every paid agent builds its own billing integration.

**Audit logging requirements** -- What agents must log for compliance. Healthcare (HIPAA), finance (SOX), and government (FedRAMP) each have specific requirements that A2A does not address.

## Ecosystem Predictions

### Framework Adoption

By the end of 2026, every major agent framework will have A2A support:

- **CrewAI and LangGraph**: Already ship native support. See [CrewAI vs LangGraph](/blog/a2a-crewai-vs-langgraph) for a comparison.
- **AutoGen (Microsoft)**: Already has A2A samples in the official repo. Expect deeper integration.
- **Semantic Kernel (.NET)**: Community implementation exists. Microsoft will likely formalize it.
- **Google ADK**: Native support since launch. See the [ADK tutorial](/blog/build-a2a-agent-google-adk).
- **Amazon Bedrock Agents**: No A2A support yet. Prediction: they ship it in Q3 2026 or risk being left out of multi-cloud agent architectures.

### Agent Count

The [StackA2A directory](/agents) tracks real, deployable A2A agents. At the time of writing, the ecosystem has dozens of agents across categories. Prediction: this grows to 500+ by end of 2026, driven by:

- Framework-level support making agent creation trivial
- Enterprise teams wrapping internal services as A2A agents
- The first paid A2A agent marketplaces launching in Q2-Q3 2026

### Consolidation

The current ecosystem has many small, overlapping agents. Five different "code review" agents, three "data analysis" agents, each with slightly different capabilities. This consolidates. The agents that survive will be the ones with:

- Genuine differentiation (not just a prompt wrapper)
- Active maintenance tracking spec changes
- Real production deployments proving reliability
- Good Agent Card descriptions enabling discovery

### MCP and A2A Convergence

A2A and MCP are not competing. They solve different problems: A2A is agent-to-agent, MCP is agent-to-tool. But the boundary gets blurry. An MCP server that wraps a database could also be an A2A agent that takes natural-language queries. Expect to see more agents that speak both protocols -- the [LangChain Data Agent](/blog/best-a2a-agents-data-analytics) already does this.

The practical convergence: agents that expose an A2A interface for agent-to-agent discovery and messaging, and an MCP interface for IDE/tool integration. Two doors to the same room.

See [A2A vs MCP](/blog/a2a-vs-mcp-comparison) for the full comparison.

## What Matters Most

If I had to rank what the ecosystem needs most, in order:

### 1. Auth delegation in multi-agent chains

Without this, enterprise adoption stalls. Every organization that deploys more than two agents hits the "who authorized this downstream call?" problem. The spec needs to standardize token delegation before the ecosystem fragments into incompatible solutions.

### 2. Agent registries with trust signals

Discovery by URL works inside an organization. Cross-organization agent discovery needs registries with verified publishers, reputation signals, and standardized search. This enables the marketplace economy that makes the ecosystem self-sustaining.

### 3. Streaming everywhere

LangGraph supports it. CrewAI does not yet. Streaming is not optional for production agents -- users will not stare at a spinner for 30 seconds while an agent thinks. Every framework needs to support `message/stream` with SSE.

### 4. Standardized error handling

The current spec defines JSON-RPC error codes but does not standardize agent-specific errors. "Task failed" is not actionable. "Task failed: upstream model rate limited, retry in 30s" is. The spec needs an error taxonomy that tells callers what went wrong and what to do about it.

### 5. Skill taxonomy (eventually)

Important for ecosystem maturity but not urgent. The current free-form descriptions work when you have dozens of agents. They will not work when you have thousands. This can wait until mid-2027 without causing real pain.

## What You Should Do Now

**If you are building agents:** Pick a framework with native A2A support (CrewAI or LangGraph), build agents that expose well-described Agent Cards, and implement OAuth2 from day one. Do not wait for the spec to finalize auth delegation -- use client credentials now and plan to migrate when delegation patterns standardize.

**If you are evaluating agents:** Browse the [StackA2A directory](/agents) to see what exists. Test agents locally before deploying. Check that they implement the skills they advertise. Read the [Agent Card guide](/blog/a2a-agent-card-explained) to understand what you are looking at.

**If you are an enterprise architect:** Start wrapping internal services as A2A agents behind your existing auth infrastructure. The protocol is stable enough for internal deployment. Cross-organization agent communication can wait until auth delegation and registries mature.

---

The A2A protocol has the right foundation: HTTP transport, JSON-RPC messaging, discoverable Agent Cards, standard security schemes. The gaps are real but addressable. The spec working group is active and responsive to implementer feedback. The framework ecosystem is converging on native support.

The most likely outcome: A2A becomes the TCP/IP of agent communication -- a boring, reliable protocol that disappears into the infrastructure. That is the best possible outcome.

Follow ecosystem updates on the [StackA2A blog](/blog) and browse the [full agent directory](/agents).
