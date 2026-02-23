---
title: "A2A Agent Discovery: Security Best Practices"
description: "How to secure the A2A agent discovery process. Covers Agent Card validation, HTTPS enforcement, capability verification, rate limiting, and trust levels for production deployments."
date: "2026-02-22"
readingTime: 8
tags: ["a2a", "security", "discovery", "best-practices"]
relatedStacks: ["security-auth"]
---

Agent discovery is the front door of the A2A protocol. Before any task is executed, a client fetches the agent's card from `/.well-known/agent-card.json` to understand what the agent can do and how to authenticate. If that discovery process is compromised, everything downstream is compromised too.

This guide covers the security considerations you should address when discovering and connecting to A2A agents in production.

## How Agent Discovery Works

The A2A discovery flow is straightforward:

1. A client knows (or is given) an agent's base URL
2. The client fetches `https://agent.example.com/.well-known/agent-card.json`
3. The Agent Card describes the agent's name, capabilities, skills, auth requirements, and endpoint URL
4. The client validates the card and starts sending tasks

Each step introduces security considerations.

## Agent Card Validation

An Agent Card is a JSON document that your client will use to configure how it talks to an agent. Treat it like untrusted input, because it is.

### Schema Validation

Always validate the Agent Card against the A2A schema before using it. A malformed or maliciously crafted card could cause unexpected behavior in your client.

```python
from pydantic import BaseModel, HttpUrl, validator
from typing import Optional

class AgentSkill(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str] = []
    inputModes: list[str] = ["text/plain"]
    outputModes: list[str] = ["text/plain"]

class AgentCapabilities(BaseModel):
    streaming: bool = False
    pushNotifications: bool = False
    stateTransitionHistory: bool = False

class AgentCard(BaseModel):
    name: str
    description: str
    url: HttpUrl
    version: str
    capabilities: AgentCapabilities
    skills: list[AgentSkill]
    securitySchemes: Optional[dict] = None
    security: Optional[list[dict]] = None

    @validator("url")
    def url_must_be_https(cls, v):
        if not str(v).startswith("https://"):
            raise ValueError("Agent URL must use HTTPS")
        return v

    @validator("name")
    def name_must_be_reasonable(cls, v):
        if len(v) > 200:
            raise ValueError("Agent name suspiciously long")
        return v
```

### Required Checks

At minimum, validate these properties:

| Check | Why | Action on Failure |
|-------|-----|-------------------|
| URL uses HTTPS | Prevents MITM attacks | Reject the agent |
| URL domain matches card host | Prevents redirect attacks | Reject the agent |
| Version is a valid semver | Ensures spec compliance | Warn and proceed cautiously |
| Skills have descriptions | Ensures meaningful discovery | Warn |
| Security schemes are present | Prevents connecting to unprotected agents | Reject for production use |
| No unexpected fields | Prevents data injection | Strip unknown fields |

### Domain Matching

The Agent Card URL should match the domain you fetched it from. If you fetch a card from `https://agent.example.com/.well-known/agent-card.json` and the card says its URL is `https://evil.example.com`, reject it.

```python
from urllib.parse import urlparse

def validate_card_origin(card_url: str, fetched_from: str) -> bool:
    """Ensure the agent card URL matches the domain it was fetched from."""
    card_domain = urlparse(card_url).netloc
    fetch_domain = urlparse(fetched_from).netloc
    return card_domain == fetch_domain
```

This prevents a class of attacks where a compromised agent redirects traffic to a malicious endpoint.

## HTTPS Enforcement

Every A2A interaction in production should happen over HTTPS. No exceptions.

### Why HTTP is Dangerous for A2A

- **Agent Cards over HTTP** can be tampered with by a network attacker who modifies the skills, endpoint URL, or security requirements
- **Tasks over HTTP** expose the full request and response, including any sensitive data in the message
- **Tokens over HTTP** are visible to anyone on the network path

### Implementation

Configure your A2A client to reject non-HTTPS URLs:

```python
class SecureA2AClient:
    def __init__(self):
        self.session = httpx.AsyncClient(
            verify=True,  # Verify TLS certificates
            timeout=30.0,
        )

    async def discover_agent(self, base_url: str) -> AgentCard:
        if not base_url.startswith("https://"):
            raise SecurityError(f"Refusing to connect to non-HTTPS agent: {base_url}")

        response = await self.session.get(
            f"{base_url}/.well-known/agent-card.json"
        )
        response.raise_for_status()

        card = AgentCard.model_validate(response.json())

        if not validate_card_origin(str(card.url), base_url):
            raise SecurityError("Agent Card URL does not match discovery URL")

        return card
```

### Certificate Validation

Do not disable TLS certificate validation, even in development. Use tools like `mkcert` to generate valid local certificates instead. Disabling verification in development leads to it being disabled in production through configuration drift.

## Capability Verification

After validating the Agent Card, verify that the agent's claimed capabilities match what you expect.

### Skill Verification

Before delegating a task to an agent, check that it advertises the skill you need:

```python
def agent_supports_skill(card: AgentCard, required_skill_id: str) -> bool:
    """Check if the agent advertises the required skill."""
    return any(
        skill.id == required_skill_id
        for skill in card.skills
    )

def agent_supports_input_mode(card: AgentCard, skill_id: str, mime_type: str) -> bool:
    """Check if the agent's skill accepts the input mode you plan to send."""
    for skill in card.skills:
        if skill.id == skill_id:
            return mime_type in skill.inputModes
    return False
```

### Capability Probing

Do not assume that an agent's claimed capabilities are accurate. An agent that claims to support streaming might not actually implement it correctly. Use defensive programming:

```python
async def send_with_fallback(client, card, message):
    """Try streaming first, fall back to regular send."""
    if card.capabilities.streaming:
        try:
            return await client.send_subscribe(message, timeout=30)
        except (StreamError, TimeoutError):
            pass  # Fall back to non-streaming

    return await client.send(message, timeout=60)
```

## Rate Limiting

Both the discovery endpoint and the task endpoints need rate limiting.

### Discovery Endpoint Rate Limiting

The `/.well-known/agent-card.json` endpoint is public by design. Without rate limiting, an attacker can:

- Enumerate all your agents by scanning URLs
- Cause resource exhaustion through rapid polling
- Map your agent infrastructure for reconnaissance

Implement rate limiting at the infrastructure level:

```nginx
# Nginx rate limiting for agent card discovery
location /.well-known/agent-card.json {
    limit_req zone=discovery burst=5 nodelay;
    limit_req_status 429;

    proxy_pass http://agent-backend;
}
```

### Task Endpoint Rate Limiting

Rate limit task submissions per authenticated client:

```python
from collections import defaultdict
from time import time

class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests = defaultdict(list)

    def allow(self, client_id: str) -> bool:
        now = time()
        # Clean old entries
        self.requests[client_id] = [
            t for t in self.requests[client_id]
            if now - t < self.window
        ]
        # Check limit
        if len(self.requests[client_id]) >= self.max_requests:
            return False

        self.requests[client_id].append(now)
        return True
```

## Trust Levels

Not all agents deserve the same level of trust. Implement a trust hierarchy.

### Trust Tiers

| Tier | Description | Requirements | Access |
|------|-------------|--------------|--------|
| **Internal** | Agents you own and operate | mTLS + OAuth2, same network | Full access |
| **Partner** | Agents from trusted organizations | OAuth2 + IP allowlist | Scoped access |
| **Public** | Agents discovered from registries | OAuth2 + strict validation | Read-only, sandboxed |
| **Unknown** | Agents with no verifiable identity | Rejected | No access |

### Implementing Trust Verification

```python
from enum import Enum

class TrustLevel(Enum):
    INTERNAL = "internal"
    PARTNER = "partner"
    PUBLIC = "public"
    UNKNOWN = "unknown"

class TrustEvaluator:
    def __init__(self, internal_domains: list[str], partner_domains: list[str]):
        self.internal_domains = internal_domains
        self.partner_domains = partner_domains

    def evaluate(self, card: AgentCard) -> TrustLevel:
        domain = urlparse(str(card.url)).netloc

        if domain in self.internal_domains:
            return TrustLevel.INTERNAL
        elif domain in self.partner_domains:
            return TrustLevel.PARTNER
        elif card.securitySchemes:
            return TrustLevel.PUBLIC
        else:
            return TrustLevel.UNKNOWN

    def allowed_actions(self, trust_level: TrustLevel) -> set[str]:
        """Return the set of actions allowed for a trust level."""
        actions = {
            TrustLevel.INTERNAL: {"read", "write", "execute", "admin"},
            TrustLevel.PARTNER: {"read", "execute"},
            TrustLevel.PUBLIC: {"read"},
            TrustLevel.UNKNOWN: set(),
        }
        return actions[trust_level]
```

### Data Sensitivity Classification

Different data requires different trust levels:

- **Public data** (product catalogs, documentation) can be sent to public agents
- **Internal data** (sales figures, roadmaps) should only go to internal or partner agents
- **Sensitive data** (PII, financial records, credentials) should only go to internal agents with audit logging

Build this classification into your coordinator agent so it automatically restricts which downstream agents can receive sensitive data.

## Registry Security

If you use an agent registry (a centralized directory of agents), additional concerns apply:

### Registry Integrity

- Only trust registries served over HTTPS with valid certificates
- Pin the registry URL in your configuration; do not allow dynamic registry discovery
- Cache registry responses and validate changes incrementally

### Agent Identity Verification

A registry listing does not guarantee that an agent is who it claims to be. Verify independently:

1. Fetch the Agent Card directly from the agent's URL (not from the registry cache)
2. Compare the directly-fetched card with the registry listing
3. If they differ, trust the directly-fetched card but log the discrepancy

### Registry Poisoning

An attacker who compromises a registry can inject malicious agent listings. Mitigations:

- Use registries that require cryptographic signing of agent listings
- Maintain an allowlist of trusted agent domains
- Monitor for new agent listings that resemble your internal agents (typosquatting)

## Security Checklist

Before connecting to any A2A agent in production:

- [ ] Agent Card fetched over HTTPS with valid certificate
- [ ] Agent Card URL matches the discovery domain
- [ ] Agent Card passes schema validation
- [ ] Security schemes are present and supported
- [ ] Required skills are advertised
- [ ] Trust level has been evaluated
- [ ] Rate limiting is configured for both discovery and task endpoints
- [ ] Data sensitivity classification is applied
- [ ] Auth tokens are obtained and validated
- [ ] Audit logging is enabled for all agent interactions

Explore the full [Security & Auth stack](/stacks/security-auth) on StackA2A to find agents and reference implementations for securing your A2A deployment.
