---
title: "A2A Agent Cards Explained: Discovery, Structure & Best Practices"
description: "Agent Cards are the foundation of A2A agent discovery. Learn their JSON structure, where they live, how capabilities and skills work, and best practices for production deployments."
date: "2026-02-22"
readingTime: 9
tags: ["a2a", "agent-card", "discovery", "guide"]
relatedStacks: ["google-adk-stack"]
---

Every A2A agent needs to answer a fundamental question: **what can you do?** Agent Cards are how they answer it. They are the discovery mechanism that makes the entire A2A protocol work — a JSON document that acts as a machine-readable resume for your agent.

Without Agent Cards, agents are black boxes. With them, any client or orchestrator can discover your agent's skills, understand its input/output formats, and know how to authenticate before sending a single task.

## What You'll Learn

- What Agent Cards are and why they matter
- The complete JSON structure with every field explained
- Where Agent Cards are hosted and how discovery works
- Skills and capabilities definitions
- Best practices for production-quality Agent Cards

## Prerequisites

- Basic understanding of JSON and HTTP
- Familiarity with the A2A protocol concepts (see [What Is the A2A Protocol?](/blog/what-is-a2a-protocol))

## What Is an Agent Card?

An Agent Card is a JSON metadata document published by an A2A server. It describes everything a client needs to know to interact with that agent: identity, capabilities, skills, endpoint URL, and authentication requirements.

Think of it as a combination of an OpenAPI spec and a service registry entry, but purpose-built for AI agents. When a client wants to discover what agents are available and what they can do, it fetches their Agent Cards.

The A2A specification defines the Agent Card as the primary mechanism for **agent discovery** — the process by which clients find and evaluate agents before sending them work.

## Where Agent Cards Live

Following RFC 8615 for well-known URIs, Agent Cards are served at a standardized path:

```
https://your-agent-domain.com/.well-known/agent-card.json
```

This convention means any client can discover any agent by simply making an HTTP GET request to this well-known URL. No service registry, no DNS tricks, no configuration file — just a predictable URL path.

```bash
curl https://your-agent.example.com/.well-known/agent-card.json
```

The response should return `Content-Type: application/json` with the full Agent Card document.

For agents that require authentication to reveal their full capabilities, the A2A spec supports an **extended Agent Card** pattern. The public card at `/.well-known/agent-card.json` contains basic information, while authenticated requests return additional skills and capabilities that are not publicly visible.

## The Complete Agent Card Structure

Here is a fully annotated Agent Card showing every major field:

```json
{
  "name": "Code Review Agent",
  "description": "Analyzes code for bugs, security vulnerabilities, and style issues across multiple languages.",
  "version": "2.1.0",
  "url": "https://code-review.example.com/a2a",
  "provider": {
    "organization": "DevTools Inc.",
    "url": "https://devtools.example.com",
    "contactEmail": "support@devtools.example.com"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": false
  },
  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/plain", "application/json"],
  "skills": [
    {
      "id": "code-review",
      "name": "Code Review",
      "description": "Reviews code for bugs, security issues, and style violations. Supports Python, JavaScript, TypeScript, Go, and Java.",
      "tags": ["code", "review", "security", "linting"],
      "examples": [
        "Review this Python function for security issues",
        "Check this TypeScript module for bugs"
      ],
      "inputModes": ["text/plain"],
      "outputModes": ["text/plain", "application/json"]
    },
    {
      "id": "dependency-audit",
      "name": "Dependency Audit",
      "description": "Scans project dependencies for known vulnerabilities and outdated packages.",
      "tags": ["dependencies", "security", "audit"],
      "examples": [
        "Audit the dependencies in this package.json",
        "Check for vulnerable packages in requirements.txt"
      ]
    }
  ],
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  },
  "security": [
    { "bearer": [] }
  ]
}
```

Let's break down each section.

## Core Identity Fields

The top-level fields establish who your agent is:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable name for the agent |
| `description` | string | Yes | What the agent does, in plain language |
| `version` | string | Yes | Semantic version of the agent |
| `url` | string | Yes | The endpoint where A2A requests are sent |
| `provider` | object | No | Organization and contact details |

The `url` field is critical — it tells clients where to send JSON-RPC requests (`message/send`, `message/stream`, `tasks/get`). This is not the Agent Card URL; it is the agent's service endpoint.

## Capabilities

The `capabilities` object declares which optional A2A features the agent supports:

```json
{
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": false
  }
}
```

- **`streaming`**: Whether the agent supports the `message/stream` method using Server-Sent Events (SSE). If `false`, clients must use `message/send` and wait for a complete response.
- **`pushNotifications`**: Whether the agent can send webhook callbacks for long-running tasks instead of requiring the client to poll.
- **`extendedAgentCard`**: Whether an authenticated request to the Agent Card URL returns additional private skills and capabilities not visible in the public card.

Only declare capabilities you actually support. A client that tries to stream against a non-streaming agent will get errors.

## Skills

Skills are the most important part of the Agent Card. Each skill represents a discrete capability the agent can perform:

```json
{
  "id": "code-review",
  "name": "Code Review",
  "description": "Reviews code for bugs, security issues, and style violations.",
  "tags": ["code", "review", "security"],
  "examples": [
    "Review this Python function for security issues"
  ],
  "inputModes": ["text/plain"],
  "outputModes": ["text/plain", "application/json"]
}
```

Key fields for each skill:

- **`id`**: Unique identifier within this agent. Use kebab-case.
- **`name`**: Human-readable skill name.
- **`description`**: Detailed description of what the skill does. Be specific — orchestrators use this to decide whether to route tasks to your agent.
- **`tags`**: Keywords for categorization and search. Keep them relevant.
- **`examples`**: Sample prompts or messages that demonstrate valid inputs. These help both humans and LLM-based orchestrators understand how to use the skill.
- **`inputModes`/`outputModes`**: MIME types this skill accepts and produces. If omitted, the agent's `defaultInputModes` and `defaultOutputModes` are used.

## Authentication and Security

The `securitySchemes` and `security` fields follow the OpenAPI pattern for declaring authentication requirements:

```json
{
  "securitySchemes": {
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "X-API-Key"
    }
  },
  "security": [
    { "apiKey": [] }
  ]
}
```

Supported security scheme types include:

- **API Key** (`apiKey`) — key in header, query, or cookie
- **HTTP Auth** (`http`) — Basic, Bearer, or other HTTP auth schemes
- **OAuth2** (`oauth2`) — client credentials, authorization code, and other OAuth2 flows
- **OpenID Connect** (`openIdConnect`) — discovery-based OIDC
- **Mutual TLS** (`mutualTLS`) — certificate-based authentication

The `security` array at the top level defines the default authentication requirement. Individual skills can override this if needed.

## Agent Card Discovery in Practice

Here is how a typical discovery flow works:

1. A client or orchestrator knows an agent's domain (e.g., `code-review.example.com`).
2. It sends a GET request to `https://code-review.example.com/.well-known/agent-card.json`.
3. It parses the response and evaluates the agent's skills, capabilities, and auth requirements.
4. If the agent's skills match the task at hand, the client authenticates (if required) and sends a `message/send` or `message/stream` request to the `url` specified in the card.

For programmatic discovery, you can fetch and parse an Agent Card with a few lines of code:

```python
import httpx

async def discover_agent(base_url: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{base_url}/.well-known/agent-card.json"
        )
        response.raise_for_status()
        return response.json()

card = await discover_agent("https://code-review.example.com")
print(f"Agent: {card['name']}")
print(f"Skills: {[s['name'] for s in card['skills']]}")
```

## Best Practices

### Write Descriptions for Machines and Humans

Your Agent Card will be read by both LLM-based orchestrators and human developers. Write skill descriptions that are specific and action-oriented:

```json
// Bad: vague, unhelpful
{ "description": "Handles code stuff" }

// Good: specific, actionable
{ "description": "Reviews Python, JavaScript, and Go code for security vulnerabilities including SQL injection, XSS, and hardcoded credentials. Returns findings with severity levels and fix suggestions." }
```

### Version Your Agent Card

Use semantic versioning and increment it when you add, remove, or change skills. Clients may cache your Agent Card, and version changes signal that they should re-fetch.

### Provide Meaningful Examples

The `examples` field is not decorative. Orchestrators that use LLMs to route tasks rely on these examples to understand what inputs your agent expects:

```json
{
  "examples": [
    "Review this Express.js middleware for authentication bypasses",
    "Scan the following React component for XSS vulnerabilities",
    "Check this SQL query builder for injection risks"
  ]
}
```

### Be Honest About Capabilities

Do not declare `streaming: true` if your agent returns everything in a single response. Do not list skills your agent handles poorly. Overrepresenting capabilities leads to failed tasks and poor reputation in multi-agent systems.

### Use Specific Input/Output Modes

Default to `text/plain` for simple agents, but declare `application/json` if your agent can handle structured input or returns structured output. This helps clients format requests correctly.

### Keep the Public Card Minimal

If your agent has sensitive or internal-only skills, use the extended Agent Card pattern. Set `extendedAgentCard: true` and return additional skills only to authenticated requests. The public card should contain enough information for discovery without exposing internal capabilities.

### Validate Your Agent Card

Before deploying, validate your Agent Card against the A2A JSON schema. Malformed cards will cause discovery failures. You can use the A2A Python SDK's built-in validation:

```python
from a2a.types import AgentCard
import json

with open("agent-card.json") as f:
    card_data = json.load(f)

# This will raise validation errors if the card is malformed
card = AgentCard(**card_data)
print(f"Valid card: {card.name} v{card.version}")
```

## Next Steps

Now that you understand Agent Cards, the next step is to build an agent that serves one. Check out [the Google ADK stack](/stacks/google-adk-stack) on StackA2A for a curated set of agents and tools that implement the A2A protocol, including agents that publish production-quality Agent Cards.
