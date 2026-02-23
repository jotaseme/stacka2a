---
title: "A2A Agent Card JSON Schema: Field-by-Field Reference"
description: "Complete reference for every field in the A2A Agent Card. Types, required vs optional, validation rules, common mistakes, and production examples."
date: "2026-03-04"
readingTime: 8
tags: ["a2a", "agent-card", "schema", "reference"]
relatedStacks: ["google-adk-stack"]
---

The Agent Card is a JSON document that describes what your A2A agent can do. It lives at `/.well-known/agent-card.json` and is the first thing any client fetches before sending your agent a task. Get it wrong and your agent is undiscoverable. Get it right and any A2A client can find, evaluate, and use your agent automatically.

This is the complete field reference.

## Minimal valid card

```json
{
  "name": "My Agent",
  "description": "Does something useful.",
  "version": "1.0.0",
  "url": "https://my-agent.example.com",
  "capabilities": {},
  "skills": [
    {
      "id": "do-thing",
      "name": "Do Thing",
      "description": "Performs the thing."
    }
  ]
}
```

Five required top-level fields: `name`, `description`, `version`, `url`, `skills`.

## Top-level fields

### `name` (string, required)

Human-readable name. Used in UIs, logs, and orchestrator displays. Don't use generic names like "Agent" or "Bot" -- orchestrators need to distinguish between agents.

### `description` (string, required)

What the agent does. LLM-based orchestrators parse this to make routing decisions, so be specific.

```json
// Bad
"description": "Handles code stuff"

// Good
"description": "Reviews code for bugs and security issues. Supports Python, JavaScript, Go. Returns line-by-line annotations with severity levels."
```

### `version` (string, required)

Semver recommended. Clients may cache your card and use version to decide when to re-fetch. Bump major version for breaking changes.

### `url` (string, required)

The endpoint where clients send JSON-RPC requests (`message/send`, `message/stream`). This is **not** the URL where the card is served.

```json
"url": "https://code-review.example.com/a2a"
```

Common mistake: setting `url` to the card path. The `url` is where task requests go. The card is discovered separately at `/.well-known/agent-card.json`.

### `capabilities` (object, recommended)

```json
{
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "extendedAgentCard": false
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `streaming` | `boolean` | `false` | Supports `message/stream` via SSE |
| `pushNotifications` | `boolean` | `false` | Can send webhook callbacks for long-running tasks |
| `extendedAgentCard` | `boolean` | `false` | Authenticated requests return additional private skills |
| `extensions` | `AgentExtension[]` | `[]` | Protocol extensions the agent supports |

Only declare `true` for capabilities you actually support. A client that tries to stream against a non-streaming agent gets an error.

### `skills` (array, required, min 1 item)

Each skill represents a discrete capability:

```json
{
  "id": "code-review",
  "name": "Code Review",
  "description": "Reviews code for bugs, security issues, and style violations.",
  "tags": ["code", "review", "security"],
  "examples": ["Review this Python function for security issues"],
  "inputModes": ["text/plain"],
  "outputModes": ["text/plain", "application/json"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique within this agent, kebab-case |
| `name` | `string` | Yes | Human-readable |
| `description` | `string` | Yes | What this skill does -- be specific for routing |
| `tags` | `string[]` | No | Lowercase keywords for search and categorization |
| `examples` | `string[]` | No | Sample prompts showing valid inputs (2-3 recommended) |
| `inputModes` | `string[]` | No | MIME types accepted (falls back to agent defaults) |
| `outputModes` | `string[]` | No | MIME types produced (falls back to agent defaults) |

**On `examples`:** Not decorative. LLM orchestrators use them to understand valid inputs. Without examples, an orchestrator guesses from the description alone.

### `defaultInputModes` / `defaultOutputModes` (string arrays)

MIME types the agent accepts and produces by default. Skills can override these.

```json
{
  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/plain", "application/json"]
}
```

Common values: `text/plain`, `application/json`, `image/png`, `application/pdf`.

### `provider` (object, optional)

```json
{
  "provider": {
    "organization": "DevTools Inc.",
    "url": "https://devtools.example.com",
    "contactEmail": "support@devtools.example.com"
  }
}
```

### `documentationUrl` / `iconUrl` (strings, optional)

Links to human-readable docs and an icon for UIs.

## Authentication fields

### `securitySchemes` (object, optional)

Follows the OpenAPI pattern. Defines available auth methods:

```json
{
  "securitySchemes": {
    "oauth2": {
      "type": "oauth2",
      "flows": {
        "clientCredentials": {
          "tokenUrl": "https://auth.example.com/token",
          "scopes": {
            "agent:read": "Read agent data",
            "agent:execute": "Execute tasks"
          }
        }
      }
    }
  }
}
```

Supported types: `apiKey`, `http` (Basic/Bearer), `oauth2`, `openIdConnect`, `mutualTLS`.

### `security` (array, optional)

Default auth requirement. Each object maps a scheme name to required scopes:

```json
{ "security": [{ "oauth2": ["agent:execute"] }] }
```

Multiple entries = alternatives (OR). Multiple keys in one entry = all required (AND). See [OAuth2 guide](/blog/secure-a2a-agents-oauth2) for implementation details.

## Validation

### Python SDK

```python
from a2a.types import AgentCard
import json

with open("agent-card.json") as f:
    card = AgentCard(**json.load(f))
    print(f"Valid: {card.name} v{card.version} ({len(card.skills)} skills)")
```

### Quick curl check

```bash
curl -s http://localhost:8000/.well-known/agent-card.json | python -c "
import json, sys
card = json.load(sys.stdin)
required = ['name', 'description', 'version', 'url', 'skills']
missing = [f for f in required if f not in card]
if missing:
    print(f'Missing: {missing}'); sys.exit(1)
if not card['skills']:
    print('Empty skills'); sys.exit(1)
print(f'Valid: {card[\"name\"]} v{card[\"version\"]} ({len(card[\"skills\"])} skills)')
"
```

## Common mistakes

**1. Confusing `url` with the card URL**
```json
// WRONG
"url": "https://example.com/.well-known/agent-card.json"
// RIGHT
"url": "https://example.com"
```

**2. Empty skills array** -- no skills means undiscoverable.

**3. Vague descriptions** -- "A helpful agent" tells an orchestrator nothing. Name languages, output formats, specific capabilities.

**4. Claiming capabilities you don't support** -- if you declare `streaming: true`, actually handle `message/stream`.

**5. Hardcoded localhost in production** -- use environment variables. See [deployment guide](/blog/deploy-a2a-agent-production).

**6. Missing examples on skills** -- the `examples` field helps both humans and LLM orchestrators understand expected inputs.

## Complete production example

```json
{
  "name": "Document Analyzer",
  "description": "Extracts structured data from PDFs, images, and text documents. Returns summaries, entities, tables, and sentiment. Supports English, Spanish, French.",
  "version": "2.3.1",
  "url": "https://doc-analyzer.example.com",
  "documentationUrl": "https://docs.example.com/doc-analyzer",
  "iconUrl": "https://example.com/icons/doc-analyzer.svg",
  "provider": {
    "organization": "DataWorks AI",
    "url": "https://dataworks.example.com",
    "contactEmail": "api-support@dataworks.example.com"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": false
  },
  "defaultInputModes": ["text/plain", "application/pdf", "image/png"],
  "defaultOutputModes": ["application/json", "text/plain"],
  "skills": [
    {
      "id": "extract-entities",
      "name": "Entity Extraction",
      "description": "Identifies people, organizations, locations, dates, and monetary values from documents.",
      "tags": ["nlp", "entities", "extraction"],
      "examples": [
        "Extract all company names and dates from this contract",
        "Find all monetary values in this invoice"
      ],
      "inputModes": ["text/plain", "application/pdf"],
      "outputModes": ["application/json"]
    },
    {
      "id": "summarize",
      "name": "Document Summary",
      "description": "Generates concise summaries with key points and actionable items.",
      "tags": ["summarization", "documents"],
      "examples": [
        "Summarize this 20-page report in 3 paragraphs",
        "List the key decisions from these meeting notes"
      ]
    },
    {
      "id": "extract-tables",
      "name": "Table Extraction",
      "description": "Finds and extracts tabular data from documents and images as structured JSON.",
      "tags": ["tables", "extraction", "data"],
      "examples": [
        "Extract the financial table from page 5",
        "Convert this spreadsheet image to JSON"
      ],
      "inputModes": ["application/pdf", "image/png"],
      "outputModes": ["application/json"]
    }
  ],
  "securitySchemes": {
    "bearer": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
  },
  "security": [{ "bearer": [] }]
}
```

This card is discoverable, descriptive, and honest about capabilities. An orchestrator knows exactly what inputs are accepted, what outputs to expect, how to authenticate, and what tasks to route here.

## Further reading

- [A2A Agent Cards: Structure and Discovery](/blog/a2a-agent-card-explained) -- conceptual overview
- [A2A Protocol Tutorial](/blog/a2a-protocol-tutorial-beginners) -- build your first agent
- [A2A Python SDK Guide](/blog/a2a-python-sdk-guide) -- programmatic card creation
- [Deploy to Production](/blog/deploy-a2a-agent-production) -- Agent Card URL management across environments
- [Agent directory](/agents) -- see how real agents structure their cards
