---
title: "A2A Agent Discovery: Security Best Practices"
description: "Securing A2A agent discovery in production: Agent Card validation, HTTPS enforcement, trust tiers, rate limiting, and a real deployment checklist."
date: "2026-02-22"
readingTime: 7
tags: ["a2a", "security", "discovery", "best-practices"]
relatedStacks: ["security-auth"]
---

Agent discovery is the front door of A2A. A client fetches `/.well-known/agent-card.json`, learns how to authenticate, and starts sending tasks. If discovery is compromised, everything downstream is compromised.

## Agent Card Validation

An Agent Card is a JSON document your client uses to configure how it talks to an agent. Treat it as untrusted input, because it is.

### Schema Validation

Validate every Agent Card before using it. A malformed or maliciously crafted card will cause unexpected behavior in your client.

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

| Check | Why | Action on Failure |
|-------|-----|-------------------|
| URL uses HTTPS | Prevents MITM attacks | Reject the agent |
| URL domain matches card host | Prevents redirect attacks | Reject the agent |
| Version is a valid semver | Ensures spec compliance | Warn and proceed cautiously |
| Skills have descriptions | Ensures meaningful discovery | Warn |
| Security schemes are present | Prevents connecting to unprotected agents | Reject for production use |
| No unexpected fields | Prevents data injection | Strip unknown fields |

### Domain Matching

The Agent Card URL must match the domain you fetched it from. If you fetch a card from `https://agent.example.com` and the card says its URL is `https://evil.example.com`, reject it immediately.

```python
from urllib.parse import urlparse

def validate_card_origin(card_url: str, fetched_from: str) -> bool:
    """Ensure the agent card URL matches the domain it was fetched from."""
    card_domain = urlparse(card_url).netloc
    fetch_domain = urlparse(fetched_from).netloc
    return card_domain == fetch_domain
```

This blocks redirect attacks where a compromised agent sends traffic to a malicious endpoint.

## HTTPS Enforcement

Every A2A interaction in production happens over HTTPS. No exceptions.

Agent Cards over HTTP can be tampered with mid-flight -- an attacker modifies the skills, endpoint URL, or security requirements. Tasks over HTTP expose the full request and response. Tokens over HTTP are visible to anyone on the network path.

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

Do not disable TLS certificate validation, even in development. Use `mkcert` to generate valid local certificates. Disabling verification in dev leads to it being disabled in production through configuration drift. Every time.

## Capability Verification

After validating the card, verify that the agent actually supports what you need.

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

Don't assume claimed capabilities are accurate. An agent that says it supports streaming might not. Code defensively:

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

Both discovery and task endpoints need rate limiting.

The `/.well-known/agent-card.json` endpoint is public by design. Without rate limiting, an attacker can enumerate your agents, cause resource exhaustion, or map your infrastructure for reconnaissance.

```nginx
# Nginx rate limiting for agent card discovery
location /.well-known/agent-card.json {
    limit_req zone=discovery burst=5 nodelay;
    limit_req_status 429;

    proxy_pass http://agent-backend;
}
```

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

Not all agents deserve the same level of trust. Build a trust hierarchy and enforce it.

| Tier | Requirements | Access |
|------|-------------|--------|
| **Internal** | mTLS + OAuth2, same network | Full access |
| **Partner** | OAuth2 + IP allowlist | Scoped access |
| **Public** | OAuth2 + strict validation | Read-only, sandboxed |
| **Unknown** | No verifiable identity | Rejected |

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

### Data Sensitivity

Match data classification to trust levels:

- **Public data** (product catalogs, docs) -- can go to public agents
- **Internal data** (sales figures, roadmaps) -- internal or partner agents only
- **Sensitive data** (PII, financial records, credentials) -- internal agents only, with audit logging

Build this into your coordinator agent so it automatically restricts which downstream agents receive sensitive data.

## Registry Security

If you use an agent registry, three things matter:

- **Pin the registry URL** in your configuration. Don't allow dynamic registry discovery. Only trust registries served over HTTPS with valid certificates.
- **Verify agent identity independently.** A registry listing doesn't prove anything. Fetch the Agent Card directly from the agent's URL, compare it with the registry listing, and log any discrepancies.
- **Watch for registry poisoning.** An attacker who compromises a registry can inject malicious agent listings. Maintain an allowlist of trusted domains. Monitor for new listings that resemble your internal agents (typosquatting).

## Deployment Runbook

Before any A2A agent goes to production, walk through this:

1. Agent Card is served over HTTPS with a valid certificate
2. Agent Card URL matches the discovery domain -- no redirects to unexpected hosts
3. Agent Card passes schema validation (use the Pydantic model above or equivalent)
4. Security schemes are present. If an agent has no auth, it doesn't go to production
5. Required skills are advertised and verified
6. Trust level is evaluated and enforced -- internal, partner, public, or rejected
7. Rate limiting is live on both `/.well-known/agent-card.json` and task endpoints
8. Data sensitivity classification is applied -- you know what data goes where
9. Auth tokens are obtained and validated on every request
10. Audit logging captures all agent interactions -- who called what, when, with what result
