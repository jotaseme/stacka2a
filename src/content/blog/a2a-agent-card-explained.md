---
title: "A2A Agent Cards: Structure, Discovery, and Production Tips"
description: "Agent Cards are JSON metadata that make A2A agent discovery work. Here's their full structure, how discovery flows, and what to get right before deploying one."
date: "2026-02-01"
readingTime: 7
tags: ["a2a", "agent-card", "discovery", "guide"]
relatedStacks: ["google-adk-stack"]
---

Every A2A agent needs to answer one question: **what can you do?** Agent Cards are how they answer it — a JSON document at a well-known URL that acts as a machine-readable resume. Without one, your agent is a black box. With one, any client or orchestrator can discover your agent's skills, understand its input/output formats, and know how to authenticate before sending a single task.

## Where they live

Agent Cards follow RFC 8615 and are served at a standardized path:

```
https://your-agent-domain.com/.well-known/agent-card.json
```

Any client discovers any agent by hitting this URL. No service registry, no DNS tricks, no configuration file. Just a predictable path and an HTTP GET.

```bash
curl https://your-agent.example.com/.well-known/agent-card.json
```

The response should return `Content-Type: application/json` with the full card.

For agents with sensitive capabilities, A2A supports an **extended Agent Card** pattern: the public card at the well-known URL contains basic info, while authenticated requests return additional private skills. Set `extendedAgentCard: true` in capabilities to signal this.

## Full structure

Here's a complete Agent Card with every major field:

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

## Core identity fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable name |
| `description` | string | Yes | What the agent does, in plain language |
| `version` | string | Yes | Semantic version |
| `url` | string | Yes | The endpoint where A2A JSON-RPC requests are sent (not the Agent Card URL) |
| `provider` | object | No | Organization and contact info |

The `url` field is where clients send `message/send`, `message/stream`, and `tasks/get` requests. Don't confuse it with the well-known path where the card itself is served.

## Capabilities

```json
{
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": false
  }
}
```

- **`streaming`** — supports `message/stream` via SSE. If `false`, clients must use `message/send` and wait for a complete response.
- **`pushNotifications`** — can send webhook callbacks for long-running tasks instead of requiring clients to poll.
- **`extendedAgentCard`** — authenticated requests to the card URL return additional private skills.

Only declare what you actually support. A client that tries to stream against a non-streaming agent will get errors.

## Skills

Skills are the most important part of the card. Each one represents a discrete capability:

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

- **`id`** — unique within this agent, kebab-case
- **`name`** — human-readable
- **`description`** — be specific here. Orchestrators use this to decide whether to route tasks to your agent. "Handles code stuff" won't cut it.
- **`tags`** — keywords for categorization and search
- **`examples`** — sample prompts showing valid inputs. Both humans and LLM-based orchestrators use these to understand how to interact with the skill.
- **`inputModes`/`outputModes`** — MIME types. Falls back to the agent-level defaults if omitted.

## Authentication

The `securitySchemes` and `security` fields follow the OpenAPI pattern:

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

Supported types: `apiKey` (header/query/cookie), `http` (Basic, Bearer), `oauth2` (client credentials, auth code, etc.), `openIdConnect`, and `mutualTLS`. The top-level `security` array sets the default; individual skills can override it.

## Discovery flow in practice

1. Client knows an agent's domain (e.g., `code-review.example.com`)
2. GET request to `/.well-known/agent-card.json`
3. Parse the card, evaluate skills, check auth requirements
4. If the skills match the task, authenticate and send a `message/send` or `message/stream` request to the `url` in the card

Programmatically:

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

## Production checklist

- **Write descriptions for machines _and_ humans.** Orchestrators parse your descriptions to make routing decisions. Be specific and action-oriented: "Reviews Python, JavaScript, and Go code for security vulnerabilities including SQL injection, XSS, and hardcoded credentials" beats "Handles code security."
- **Version your card.** Use semver, increment when skills change. Clients may cache your card and use version to decide when to re-fetch.
- **Make examples count.** The `examples` field isn't decorative. LLM-based orchestrators rely on them to understand valid inputs. Include 2-3 real examples per skill.
- **Don't lie about capabilities.** If you declare `streaming: true`, actually support SSE. Overrepresenting capabilities leads to failed tasks and broken integrations.
- **Declare input/output modes explicitly.** Default to `text/plain` for simple agents, add `application/json` if you handle structured data. This helps clients format requests correctly.
- **Keep the public card minimal.** If you have internal-only skills, use the extended card pattern. The public card should have enough info for discovery without exposing internal capabilities.
- **Validate before deploying.** Malformed cards break discovery. Use the SDK's built-in validation:

```python
from a2a.types import AgentCard
import json

with open("agent-card.json") as f:
    card_data = json.load(f)

# Raises validation errors if the card is malformed
card = AgentCard(**card_data)
print(f"Valid card: {card.name} v{card.version}")
```

See also: [What Is A2A](/blog/what-is-a2a-protocol) for protocol fundamentals, or the [Google ADK stack](/stacks/google-adk-stack) for agents with production-quality cards.
