---
title: "A2A Agent Card Specification"
description: "Complete reference for A2A Agent Cards: every field, validation rules, security schemes, and production patterns."
readingTime: 18
order: 2
icon: "card"
---

An Agent Card is a JSON document that tells the world what an A2A agent can do, how to talk to it, and how to authenticate. It is the single source of truth for agent discovery. No card, no discovery. No discovery, no interoperability.

This is the complete field-by-field reference. For a gentler introduction, read [A2A Agent Cards Explained](/blog/a2a-agent-card-explained). To validate a card you have already written, use the [Agent Card Validator](/tools/agent-card-validator). To see real-world examples in production, browse the [agent directory](/agents).

## Where Agent Cards live

Agent Cards are served at a well-known URL defined by [RFC 8615](https://tools.ietf.org/html/rfc8615):

```
https://{agent-domain}/.well-known/agent-card.json
```

That is the entire discovery mechanism. A client that knows an agent's domain makes an HTTP GET to this path and receives the card as `application/json`. No service registry. No DNS SRV records. No sidecar configuration. One URL, one JSON document.

```bash
curl -s https://code-review.example.com/.well-known/agent-card.json | jq .
```

### Requirements for the endpoint

- **MUST** return `Content-Type: application/json`
- **MUST** be accessible via HTTPS in production (HTTP is acceptable only during local development)
- **SHOULD** return appropriate `Cache-Control` headers (more on this in [Version management and caching](#version-management-and-client-caching))
- **SHOULD** support CORS if the card will be fetched from browser-based clients
- **MUST NOT** require authentication for the base card (authentication applies only to extended cards)

The well-known path serves the card itself. The `url` field inside the card points to the JSON-RPC endpoint where clients send actual A2A messages. These are different URLs. Confusing them is the most common deployment mistake.

```
/.well-known/agent-card.json   --> the card (GET, public)
/a2a                           --> the RPC endpoint (POST, authenticated)
```

## Complete field reference

### Top-level fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Human-readable agent name. Keep it under 60 characters. |
| `description` | `string` | Yes | What the agent does. Written for both humans and LLM orchestrators. Be specific. |
| `version` | `string` | Yes | Semantic version of the agent (not the protocol). Follows [semver](https://semver.org/). |
| `url` | `string` (URL) | Yes | The A2A JSON-RPC endpoint. Clients send `message/send`, `message/stream`, and `tasks/get` here. |
| `provider` | `object` | No | Organization that operates the agent. |
| `capabilities` | `object` | No | What protocol features the agent supports. |
| `skills` | `array` | Yes | List of discrete capabilities the agent offers. Minimum one skill. |
| `defaultInputModes` | `string[]` | No | MIME types the agent accepts by default. Falls back to `["text/plain"]` if omitted. |
| `defaultOutputModes` | `string[]` | No | MIME types the agent returns by default. Falls back to `["text/plain"]` if omitted. |
| `securitySchemes` | `object` | No | Named authentication schemes, following OpenAPI 3.x conventions. |
| `security` | `array` | No | Which schemes are required at the agent level. Each entry is an object mapping a scheme name to required scopes. |
| `documentationUrl` | `string` (URL) | No | Link to human-readable documentation for the agent. |
| `supportsAuthenticatedExtendedCard` | `boolean` | No | Deprecated alias for `capabilities.extendedAgentCard`. Use the capabilities field instead. |

### Provider object

| Field | Type | Required | Description |
|---|---|---|---|
| `organization` | `string` | Yes (if provider present) | Company or team name. |
| `url` | `string` (URL) | No | Organization homepage. |
| `contactEmail` | `string` (email) | No | Support or operations email. |

```json
{
  "provider": {
    "organization": "Acme AI Labs",
    "url": "https://acme-ai.example.com",
    "contactEmail": "agents@acme-ai.example.com"
  }
}
```

## Capabilities object

The `capabilities` object declares which optional A2A protocol features this agent implements. Every field defaults to `false` if omitted.

```json
{
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": false
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `streaming` | `boolean` | `false` | Agent supports `message/stream` via Server-Sent Events (SSE). When `false`, clients must use `message/send` and wait for a complete response. |
| `pushNotifications` | `boolean` | `false` | Agent can deliver webhook callbacks for long-running tasks. Eliminates polling. Requires the client to provide a callback URL in the task request. |
| `extendedAgentCard` | `boolean` | `false` | When `true`, authenticated GET requests to the well-known URL return a card with additional private skills that are hidden from the public card. |

### When to enable each capability

**Streaming** -- enable when your agent produces output incrementally (LLM token streaming, progressive analysis, real-time data). Clients get partial results via SSE as they are generated. If you declare streaming but your agent buffers the entire response and sends it at once, you are wasting everyone's time. Only declare it if you actually stream.

**Push notifications** -- enable for tasks that take more than a few seconds. Image generation, large-scale data analysis, multi-step workflows. Without push notifications, clients must poll `tasks/get` repeatedly. With them, you POST to the client's callback URL when the task completes or updates.

**Extended Agent Card** -- enable when you have skills that should only be visible to authenticated clients. Common in enterprise deployments where a public card advertises general capabilities and authenticated clients see internal-only skills (e.g., "access-production-database" or "deploy-to-staging").

## Skills array

Skills are the most important part of the card. They define what the agent actually does. Orchestrators -- both LLM-based and deterministic -- use skill metadata to decide whether to route a task to your agent.

### Skill fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique identifier within this agent. Use kebab-case: `code-review`, `dependency-audit`, `translate-document`. |
| `name` | `string` | Yes | Human-readable name. |
| `description` | `string` | Yes | What this skill does. This is the most important field in the entire card. See guidance below. |
| `tags` | `string[]` | No | Keywords for categorization, search, and filtering. |
| `examples` | `string[]` | No | Sample prompts showing valid inputs. Critical for LLM-based orchestrators. Include 2-5 per skill. |
| `inputModes` | `string[]` | No | MIME types this skill accepts. Overrides `defaultInputModes`. |
| `outputModes` | `string[]` | No | MIME types this skill returns. Overrides `defaultOutputModes`. |

```json
{
  "skills": [
    {
      "id": "code-review",
      "name": "Code Review",
      "description": "Analyzes source code for bugs, security vulnerabilities (SQL injection, XSS, hardcoded secrets), and style violations. Supports Python, JavaScript, TypeScript, Go, Java, and Rust. Returns findings as structured JSON with severity levels, line references, and suggested fixes.",
      "tags": ["code", "review", "security", "static-analysis"],
      "examples": [
        "Review this Python function for security vulnerabilities",
        "Check this TypeScript module for bugs and suggest fixes",
        "Analyze this Go HTTP handler for injection risks"
      ],
      "inputModes": ["text/plain", "application/json"],
      "outputModes": ["application/json", "text/plain"]
    }
  ]
}
```

### Writing effective skill descriptions

The `description` field is how orchestrators decide whether your agent is the right one for a task. Bad descriptions lead to misrouted tasks, wasted compute, and frustrated users.

**Bad descriptions:**

- "Does code stuff" -- too vague
- "A powerful AI agent for code" -- marketing copy, zero information
- "Handles code review" -- what languages? What kind of issues? What output format?

**Good descriptions:**

- "Analyzes source code for bugs, security vulnerabilities (SQL injection, XSS, hardcoded secrets), and style violations. Supports Python, JavaScript, TypeScript, Go, Java, and Rust. Returns findings as structured JSON with severity levels, line references, and suggested fixes."
- "Translates documents between English, Spanish, French, German, and Japanese. Accepts plain text or Markdown. Preserves formatting. Returns translated text in the same format as input."

Rules of thumb:

1. **State what actions the skill performs** -- "Analyzes", "Translates", "Generates", "Validates"
2. **List supported inputs** -- languages, formats, data types
3. **Describe the output** -- structured JSON, plain text, images, what fields are included
4. **Mention limits** -- maximum file size, supported versions, excluded cases
5. **Write for machines first, humans second** -- an LLM orchestrator reading this description makes routing decisions in milliseconds

### Skill examples

The `examples` array is not decorative. LLM-based orchestrators use these as few-shot examples to understand how to formulate requests to your agent. Think of them as the canonical prompts your agent handles best.

Each example should be a realistic user query or instruction. Vary the examples to cover the range of inputs the skill handles:

```json
"examples": [
  "Review this Python function for security vulnerabilities",
  "Check this TypeScript module for bugs and suggest fixes",
  "Analyze this Go HTTP handler for injection risks",
  "Find performance issues in this Java stream pipeline"
]
```

Do not include trivial examples like "Hello" or "Test". Do not include examples your agent cannot actually handle.

## Security schemes

Agent Cards use the same security scheme format as [OpenAPI 3.x](https://swagger.io/docs/specification/authentication/). Security is declared in two parts:

1. **`securitySchemes`** -- defines the available authentication mechanisms
2. **`security`** -- specifies which mechanisms are required (at the agent level or per-skill)

### API Key

The simplest scheme. The client sends a key in a header, query parameter, or cookie.

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

| Field | Type | Required | Values |
|---|---|---|---|
| `type` | `string` | Yes | `"apiKey"` |
| `in` | `string` | Yes | `"header"`, `"query"`, or `"cookie"` |
| `name` | `string` | Yes | The header name, query parameter name, or cookie name. |

Use `"header"` unless you have a specific reason not to. Query parameters expose keys in server logs and browser history. Cookies add complexity around SameSite and domain scoping.

### HTTP Authentication (Bearer / Basic)

Standard HTTP authentication using the `Authorization` header.

**Bearer token (most common):**

```json
{
  "securitySchemes": {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  },
  "security": [
    { "bearerAuth": [] }
  ]
}
```

**Basic authentication:**

```json
{
  "securitySchemes": {
    "basicAuth": {
      "type": "http",
      "scheme": "basic"
    }
  },
  "security": [
    { "basicAuth": [] }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | `"http"` |
| `scheme` | `string` | Yes | `"bearer"` or `"basic"` |
| `bearerFormat` | `string` | No | Hint about the token format, e.g. `"JWT"`. Informational only. |

Bearer with JWT is the default choice for most agent deployments. Basic auth should only be used for internal agents behind a VPN where simplicity outweighs security.

### OAuth 2.0

Full OAuth 2.0 support with all standard flows. This is the right choice for agents that need delegated access to user resources.

```json
{
  "securitySchemes": {
    "oauth2": {
      "type": "oauth2",
      "flows": {
        "clientCredentials": {
          "tokenUrl": "https://auth.example.com/oauth/token",
          "scopes": {
            "agent:read": "Read access to agent resources",
            "agent:write": "Write access to agent resources"
          }
        }
      }
    }
  },
  "security": [
    { "oauth2": ["agent:read"] }
  ]
}
```

#### Supported OAuth 2.0 flows

| Flow | Fields | Use case |
|---|---|---|
| `clientCredentials` | `tokenUrl`, `scopes` | Service-to-service. No user involved. The most common flow for agent-to-agent communication. |
| `authorizationCode` | `authorizationUrl`, `tokenUrl`, `scopes`, `refreshUrl` (optional) | User-delegated access. The client redirects a human to approve access, then exchanges the code for a token. |
| `implicit` | `authorizationUrl`, `scopes` | Deprecated. Do not use for new agents. Listed for completeness. |
| `password` | `tokenUrl`, `scopes` | Resource owner password credentials. Only for trusted first-party clients. |

**Client credentials flow** (service-to-service, most common for A2A):

```json
"flows": {
  "clientCredentials": {
    "tokenUrl": "https://auth.example.com/oauth/token",
    "scopes": {
      "agent:execute": "Execute agent tasks",
      "agent:status": "Check task status"
    }
  }
}
```

**Authorization code flow** (user-delegated access):

```json
"flows": {
  "authorizationCode": {
    "authorizationUrl": "https://auth.example.com/oauth/authorize",
    "tokenUrl": "https://auth.example.com/oauth/token",
    "refreshUrl": "https://auth.example.com/oauth/refresh",
    "scopes": {
      "user:repos": "Access user repositories",
      "user:profile": "Read user profile"
    }
  }
}
```

The `security` array at the agent or skill level references the scheme name and lists required scopes:

```json
"security": [
  { "oauth2": ["agent:execute", "agent:status"] }
]
```

An empty scopes array means the scheme is required but no specific scopes are mandated.

### OpenID Connect

For agents integrated into an identity provider ecosystem. The client discovers all OAuth endpoints and key material from the OpenID Connect discovery document.

```json
{
  "securitySchemes": {
    "oidc": {
      "type": "openIdConnect",
      "openIdConnectUrl": "https://auth.example.com/.well-known/openid-configuration"
    }
  },
  "security": [
    { "oidc": [] }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | `"openIdConnect"` |
| `openIdConnectUrl` | `string` (URL) | Yes | URL of the OIDC discovery document. Must point to a valid `.well-known/openid-configuration`. |

Use this when your agent is part of a larger platform that already uses OIDC (enterprise SSO, Google Workspace, Azure AD).

### Mutual TLS (mTLS)

Both client and server present certificates. Maximum security, maximum setup complexity.

```json
{
  "securitySchemes": {
    "mtls": {
      "type": "mutualTLS"
    }
  },
  "security": [
    { "mtls": [] }
  ]
}
```

No additional fields are needed. The TLS handshake handles everything. Use this for high-security environments: financial services, healthcare, government. The operational overhead of certificate management is significant, so only choose mTLS when the security requirements justify it.

### Security scheme comparison

| Scheme | Complexity | Best for | Token management | User delegation |
|---|---|---|---|---|
| `apiKey` | Low | Internal tools, prototypes, simple integrations | Manual rotation | No |
| `http` (Bearer) | Low | Standard API access with JWT | Automatic (JWT expiry) | No |
| `http` (Basic) | Low | Internal agents behind VPN | Manual | No |
| `oauth2` (client credentials) | Medium | Service-to-service A2A communication | Automatic (token refresh) | No |
| `oauth2` (authorization code) | High | User-delegated access to resources | Automatic (refresh tokens) | Yes |
| `openIdConnect` | High | Enterprise SSO integration | Automatic (OIDC provider) | Yes |
| `mutualTLS` | Very high | High-security / regulated environments | Certificate lifecycle | No |

For most A2A deployments, start with **Bearer JWT** for simplicity or **OAuth 2.0 client credentials** for service-to-service auth. Move to OIDC or mTLS only when your security requirements demand it. For a deeper treatment of OAuth 2.0 in A2A, read [Securing A2A Agents with OAuth 2.0](/blog/secure-a2a-agents-oauth2).

### Combining multiple schemes

You can require multiple schemes simultaneously (AND) or offer alternatives (OR):

```json
// OR: client can use either scheme
"security": [
  { "bearerAuth": [] },
  { "apiKey": [] }
]

// AND: client must satisfy both (use a single object with multiple keys)
"security": [
  { "bearerAuth": [], "mtls": [] }
]
```

Each entry in the `security` array is an alternative (OR). Keys within a single entry must all be satisfied (AND).

## Extended Agent Cards

When `capabilities.extendedAgentCard` is `true`, the agent serves two versions of the card from the same URL:

1. **Public card** -- returned for unauthenticated GET requests. Contains general skills visible to everyone.
2. **Extended card** -- returned for authenticated GET requests. Contains additional private skills on top of the public ones.

```
GET /.well-known/agent-card.json
Authorization: (none)
--> Public card: 3 skills

GET /.well-known/agent-card.json
Authorization: Bearer eyJhbGciOiJSUz...
--> Extended card: 3 public skills + 2 private skills
```

This pattern is essential for enterprise agents that expose different capabilities to different audiences. The public card might advertise "code review" and "linting," while the extended card adds "deploy to production" and "access internal databases."

### Implementation pattern

```python
from starlette.requests import Request
from starlette.responses import JSONResponse

PUBLIC_CARD = {
    "name": "Platform Agent",
    "version": "1.4.0",
    "url": "https://platform.example.com/a2a",
    "capabilities": {"extendedAgentCard": True},
    "skills": [
        {"id": "code-review", "name": "Code Review", "description": "..."},
    ],
    "securitySchemes": {
        "bearer": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    },
    "security": [{"bearer": []}],
}

PRIVATE_SKILLS = [
    {"id": "deploy-staging", "name": "Deploy to Staging", "description": "..."},
    {"id": "query-prod-db", "name": "Query Production DB", "description": "..."},
]

async def agent_card(request: Request):
    auth = request.headers.get("Authorization")
    card = {**PUBLIC_CARD}
    if auth and verify_token(auth):
        card["skills"] = card["skills"] + PRIVATE_SKILLS
    return JSONResponse(card)
```

The key rule: the extended card is a superset. It includes everything from the public card plus additional skills. Never remove public skills from the extended version.

## Input and output MIME types

MIME types tell clients what data formats a skill accepts and returns. They are declared at two levels:

- **Agent-level defaults** -- `defaultInputModes` and `defaultOutputModes`
- **Skill-level overrides** -- `inputModes` and `outputModes` on individual skills

If a skill does not declare its own modes, the agent defaults apply. If the agent does not declare defaults, the implicit default is `["text/plain"]`.

### Common MIME types in A2A

| MIME type | Use case | When to use |
|---|---|---|
| `text/plain` | Simple text prompts and responses | Default for conversational agents. Works for most LLM-based agents. |
| `application/json` | Structured data exchange | When you need typed fields, nested objects, or machine-parseable output. |
| `image/png` | Image input or output | Image generation, diagram creation, screenshot analysis. |
| `image/jpeg` | Compressed image data | Photo analysis, thumbnail generation. |
| `application/pdf` | Document processing | PDF analysis, extraction, conversion. |
| `audio/wav` | Audio processing | Speech-to-text, audio analysis. |
| `video/mp4` | Video processing | Video summarization, frame extraction. |
| `text/markdown` | Formatted text | When the agent produces rich formatted output. |
| `text/html` | HTML content | Web scraping results, rendered reports. |

### Choosing input/output modes

Declare the modes you actually handle. If your agent accepts JSON input but only returns plain text, say so:

```json
{
  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    {
      "id": "analyze-image",
      "name": "Image Analysis",
      "inputModes": ["image/png", "image/jpeg"],
      "outputModes": ["application/json"]
    }
  ]
}
```

The image analysis skill overrides the agent defaults because it accepts images (not text) and returns structured JSON (not plain text).

Do not declare MIME types you do not support. A client that sends an image to an agent advertising `image/png` input will expect it to work. If you silently ignore the image and process only the text portion of the message, you have broken the contract.

## Validation

### JSON Schema validation

The A2A protocol publishes a JSON Schema for Agent Cards. Use it to validate cards before deployment:

```bash
# Validate using ajv-cli
npm install -g ajv-cli
ajv validate -s a2a-agent-card-schema.json -d my-agent-card.json
```

### SDK validation (Python)

The Python A2A SDK provides Pydantic models that validate cards at parse time:

```python
from a2a.types import AgentCard
import json

with open("agent-card.json") as f:
    raw = json.load(f)

try:
    card = AgentCard(**raw)
    print(f"Valid: {card.name} v{card.version}")
    print(f"Skills: {[s.id for s in card.skills]}")
    print(f"Streaming: {card.capabilities.streaming if card.capabilities else False}")
except Exception as e:
    print(f"Validation failed: {e}")
```

### SDK validation (TypeScript)

```typescript
import { AgentCard } from "@anthropic-ai/a2a-sdk";

const raw = await fetch("https://agent.example.com/.well-known/agent-card.json");
const data = await raw.json();

try {
  const card = AgentCard.parse(data);
  console.log(`Valid: ${card.name} v${card.version}`);
} catch (err) {
  console.error("Invalid card:", err.errors);
}
```

You can also use the [Agent Card Validator](/tools/agent-card-validator) on this site to paste a card and get instant validation feedback.

### Common validation errors

| Error | Cause | Fix |
|---|---|---|
| `name is required` | Missing `name` field | Add a `name` string to the top level |
| `url must be a valid URL` | Malformed or missing `url` | Use a fully qualified HTTPS URL including the path |
| `skills must contain at least 1 item` | Empty or missing `skills` array | Add at least one skill object |
| `skill.id must be unique` | Duplicate skill IDs | Give each skill a distinct `id` |
| `securitySchemes.*.type is invalid` | Unrecognized security type | Use one of: `apiKey`, `http`, `oauth2`, `openIdConnect`, `mutualTLS` |
| `version must follow semver` | Non-semver version string | Use `MAJOR.MINOR.PATCH` format |
| `capabilities.streaming must be boolean` | String "true" instead of boolean | Use `true` not `"true"` |

## Version management and client caching

The `version` field follows [semantic versioning](https://semver.org/):

- **PATCH** (1.0.0 --> 1.0.1): Bug fixes, description updates, no behavior change
- **MINOR** (1.0.0 --> 1.1.0): New skills added, new optional capabilities
- **MAJOR** (1.0.0 --> 2.0.0): Breaking changes -- removed skills, changed authentication, different output formats

Clients use the version to decide when to re-fetch and re-parse the card. A well-behaved client caches the card and periodically checks for updates.

### Caching headers

Set appropriate cache headers on the well-known endpoint:

```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
ETag: "v2.1.0-abc123"
```

This tells clients:

- Cache the card for 1 hour
- Serve stale content for up to 24 hours while revalidating in the background
- Use the `ETag` for conditional requests (`If-None-Match`)

```python
from starlette.responses import JSONResponse
import hashlib, json

card_json = json.dumps(AGENT_CARD, sort_keys=True)
etag = hashlib.md5(card_json.encode()).hexdigest()

async def agent_card_endpoint(request):
    if request.headers.get("If-None-Match") == f'"{etag}"':
        return Response(status_code=304)

    return JSONResponse(
        AGENT_CARD,
        headers={
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "ETag": f'"{etag}"',
        }
    )
```

Do not set `no-cache` unless your card changes multiple times per hour. Aggressive caching reduces load on your agent and improves discovery latency for clients.

## Full annotated example

Here is a complete Agent Card using every field covered in this reference:

```json
{
  "name": "Enterprise Code Assistant",
  "description": "Multi-skill code analysis and generation agent. Reviews code for security vulnerabilities, generates unit tests, and audits dependencies. Supports Python, TypeScript, Go, Java, and Rust.",
  "version": "2.3.1",
  "url": "https://code-assistant.acme.example.com/a2a",
  "documentationUrl": "https://docs.acme.example.com/code-assistant",

  "provider": {
    "organization": "Acme Engineering",
    "url": "https://acme.example.com",
    "contactEmail": "platform-agents@acme.example.com"
  },

  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": true
  },

  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/plain", "application/json"],

  "skills": [
    {
      "id": "code-review",
      "name": "Security Code Review",
      "description": "Analyzes source code for security vulnerabilities including SQL injection, XSS, CSRF, hardcoded secrets, insecure deserialization, and path traversal. Supports Python, TypeScript, Go, Java, and Rust. Returns structured findings with CVSS severity, CWE references, affected line ranges, and remediation suggestions.",
      "tags": ["security", "code-review", "sast", "vulnerabilities"],
      "examples": [
        "Review this Flask route handler for injection vulnerabilities",
        "Check this Express.js middleware for XSS risks",
        "Analyze this Go HTTP handler for path traversal"
      ],
      "inputModes": ["text/plain"],
      "outputModes": ["application/json", "text/plain"]
    },
    {
      "id": "test-generation",
      "name": "Unit Test Generator",
      "description": "Generates unit tests for functions and classes. Produces pytest tests for Python, Jest tests for TypeScript, and Go table-driven tests. Covers happy path, edge cases, and error conditions. Returns test code as plain text.",
      "tags": ["testing", "unit-tests", "code-generation"],
      "examples": [
        "Generate pytest tests for this data validation class",
        "Write Jest tests for this React hook",
        "Create Go table-driven tests for this parser function"
      ],
      "inputModes": ["text/plain"],
      "outputModes": ["text/plain"]
    },
    {
      "id": "dependency-audit",
      "name": "Dependency Audit",
      "description": "Scans project dependency manifests (package.json, requirements.txt, go.mod, pom.xml, Cargo.toml) for known CVEs, outdated packages, and license compliance issues. Returns a structured report with severity ratings and upgrade recommendations.",
      "tags": ["dependencies", "security", "audit", "sca"],
      "examples": [
        "Audit dependencies in this package.json for known vulnerabilities",
        "Check this requirements.txt for outdated packages",
        "Scan this Cargo.toml for license compliance issues"
      ],
      "inputModes": ["text/plain", "application/json"],
      "outputModes": ["application/json"]
    }
  ],

  "securitySchemes": {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    },
    "oauth2": {
      "type": "oauth2",
      "flows": {
        "clientCredentials": {
          "tokenUrl": "https://auth.acme.example.com/oauth/token",
          "scopes": {
            "agent:execute": "Execute agent tasks",
            "agent:status": "Read task status"
          }
        },
        "authorizationCode": {
          "authorizationUrl": "https://auth.acme.example.com/oauth/authorize",
          "tokenUrl": "https://auth.acme.example.com/oauth/token",
          "refreshUrl": "https://auth.acme.example.com/oauth/refresh",
          "scopes": {
            "user:repos": "Access user repositories",
            "agent:execute": "Execute agent tasks"
          }
        }
      }
    }
  },
  "security": [
    { "bearerAuth": [] },
    { "oauth2": ["agent:execute"] }
  ]
}
```

### What to notice

- **`url`** points to `/a2a`, not to the well-known path. The card lives at `/.well-known/agent-card.json`; the RPC endpoint is at `/a2a`.
- **`security`** has two entries (OR): clients can authenticate with either a Bearer JWT or an OAuth 2.0 token with the `agent:execute` scope.
- **`extendedAgentCard: true`** signals that authenticated requests to the card URL return additional private skills beyond these three.
- **Each skill has specific, detailed descriptions.** An orchestrator reading these can confidently route a "check my package.json for vulnerabilities" request to the `dependency-audit` skill.
- **Examples are realistic prompts.** They show the range of inputs each skill handles.
- **Input/output modes vary by skill.** The dependency audit skill accepts both text and JSON but only returns JSON.

## Production checklist

Before deploying an Agent Card, verify every item on this list.

### Discovery and availability

- [ ] Card is served at `https://{domain}/.well-known/agent-card.json`
- [ ] Response content type is `application/json`
- [ ] HTTPS is enabled (not plain HTTP)
- [ ] CORS headers are set if browser clients need to fetch the card
- [ ] The endpoint returns the card within 500ms (clients time out on slow discovery)

### Identity

- [ ] `name` is concise and unique within your organization
- [ ] `description` is specific enough for an LLM orchestrator to make routing decisions
- [ ] `version` follows semver and is incremented on every change
- [ ] `url` points to the correct A2A JSON-RPC endpoint (not the card URL)
- [ ] `provider` is populated with valid organization info and contact email

### Skills

- [ ] At least one skill is declared
- [ ] Every skill has a unique `id` in kebab-case
- [ ] Descriptions state what the skill does, what inputs it handles, and what outputs it produces
- [ ] 2-5 realistic `examples` per skill
- [ ] `tags` are present for search and categorization
- [ ] `inputModes` and `outputModes` are accurate -- do not declare formats you do not support

### Capabilities

- [ ] `streaming` is only `true` if the agent actually streams via SSE
- [ ] `pushNotifications` is only `true` if the agent sends webhook callbacks
- [ ] `extendedAgentCard` is only `true` if authenticated card requests return additional skills
- [ ] Do not declare capabilities you have not implemented. Lying about capabilities causes runtime failures.

### Security

- [ ] `securitySchemes` accurately describe the authentication mechanisms
- [ ] `security` references valid scheme names from `securitySchemes`
- [ ] OAuth token URLs are reachable and correctly configured
- [ ] OIDC discovery URLs point to valid `.well-known/openid-configuration` documents
- [ ] API keys are not hardcoded in the card (the card describes the scheme, not the credentials)

### Caching and versioning

- [ ] `Cache-Control` header is set with reasonable `max-age` (1 hour is a good default)
- [ ] `ETag` is generated from card content for conditional requests
- [ ] Version is bumped whenever skills, capabilities, or security schemes change

### Validation

- [ ] Card passes JSON Schema validation
- [ ] Card parses successfully with the Python or TypeScript A2A SDK
- [ ] Card validates without errors in the [Agent Card Validator](/tools/agent-card-validator)
- [ ] All URLs in the card are reachable (no dead links)

## Common mistakes

**Confusing `url` with the card URL.** The `url` field is where JSON-RPC requests go. The card is served at `/.well-known/agent-card.json`. These are different endpoints.

**Declaring `streaming: true` without implementing SSE.** If a client opens an SSE connection to your agent and gets nothing back, or gets a single chunk followed by a close, your streaming implementation is broken.

**Vague skill descriptions.** "This agent handles tasks" tells an orchestrator nothing. Be specific about inputs, outputs, supported formats, and limitations.

**Empty `examples` arrays.** Omitting examples is acceptable. An empty array is a signal that says "I have examples" but delivers nothing. Either include real examples or omit the field entirely.

**Not versioning the card.** If you change skills and keep the same version, clients with cached cards will not know to re-fetch. Always bump the version.

**Overloading a single skill.** If a skill does five different things, split it into five skills. Orchestrators match tasks to skills, not to agents. A granular skill list produces better routing.

**Exposing sensitive skills in the public card.** If a skill grants access to production infrastructure or internal data, it belongs in the extended card behind authentication. The public card should only contain skills you are comfortable exposing to any client on the internet.

## Further reading

- [A2A Agent Cards Explained](/blog/a2a-agent-card-explained) -- gentler introduction with discovery flow walkthrough
- [Securing A2A Agents with OAuth 2.0](/blog/secure-a2a-agents-oauth2) -- deep dive on OAuth flows for agent auth
- [Agent Card Validator](/tools/agent-card-validator) -- paste a card, get instant validation
- [Agent Directory](/agents) -- browse production Agent Cards from real agents
- [A2A Agent Discovery and Security](/blog/a2a-agent-discovery-security) -- discovery patterns and threat models
