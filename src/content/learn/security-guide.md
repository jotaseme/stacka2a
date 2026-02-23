---
title: "A2A Security Guide"
description: "Authentication, authorization, transport security, and threat modeling for production A2A deployments."
readingTime: 17
order: 4
icon: "shield"
---

A2A agents are HTTP services exposed to a network. Every security problem that applies to REST APIs applies to A2A, plus a few unique to agent-to-agent communication. This guide covers what actually matters when you deploy A2A agents to production.

If you take away one thing: **an A2A agent without authentication is a public API**. Agent Cards live at `/.well-known/agent-card.json`. Anyone who knows the URL -- or anyone who can guess it -- can discover your agent, read its capabilities, and start sending tasks. Treat every agent as a publicly addressable service, because it is.

## Threat Model: What Can Go Wrong

Before you write a single line of auth code, understand what you're defending against. These are the real threats to A2A deployments, ordered by how often they show up in practice.

### Unauthorized Access

The most common failure. An agent accepts tasks from any caller without verifying identity. This happens when teams deploy agents to "internal" networks and assume network isolation is sufficient. It never is. Lateral movement, misconfigured firewalls, and cloud VPC misconfigurations all break that assumption.

**Impact**: Unauthorized callers execute arbitrary skills. If your agent writes to a database, sends emails, or calls paid APIs, an attacker gets all of that for free.

### Data Exfiltration Through Agent Responses

Agents process sensitive data: financial records, PII, proprietary code, internal documents. If an agent returns too much information in error messages, debugging output, or overly verbose responses, that data leaks to the caller.

**Impact**: Confidential data exposed to unauthorized parties. Compliance violations (GDPR, HIPAA, SOC 2).

### Man-in-the-Middle Attacks

A2A communication happens over HTTP. Without TLS, every message, task, artifact, and credential flows in plaintext. This includes bearer tokens, task payloads, and agent responses.

**Impact**: Credential theft, data interception, message tampering.

### Skill Injection

A malicious caller crafts a task message that tricks the agent into executing a skill it shouldn't, or executing a skill with parameters the caller shouldn't have access to. This is the agent equivalent of SQL injection -- the boundary between data and instruction gets blurred.

**Impact**: Privilege escalation within the agent. Execution of administrative or dangerous skills by unprivileged callers.

### Prompt Injection via Agent Chaining

This is the threat unique to multi-agent systems. Agent A calls Agent B, which calls Agent C. If Agent B passes Agent A's input directly to Agent C without sanitization, Agent A can inject instructions that Agent C treats as legitimate. The chain of trust propagates malicious input.

**Impact**: An attacker compromises one agent in a chain and uses it to pivot to others. The deeper the chain, the harder this is to detect.

### Agent Card Poisoning

An attacker modifies or spoofs an Agent Card to redirect traffic. If a client fetches an Agent Card over HTTP (not HTTPS), or doesn't validate the card's contents, the attacker can point the client to a malicious agent that impersonates the real one.

**Impact**: Traffic hijacking, credential theft, data exfiltration.

### Denial of Service

Agents that accept unbounded input or don't rate-limit requests are vulnerable to resource exhaustion. A single caller sending thousands of concurrent tasks can take down an agent and everything downstream from it.

**Impact**: Service unavailability, cascading failures in agent chains.

## Authentication Schemes

The A2A protocol supports multiple authentication schemes declared in the Agent Card's `securitySchemes` field. Here's when to use each one, and how to implement them correctly.

### API Keys

The simplest scheme. The caller includes a static key in the request header.

```json
{
  "securitySchemes": {
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "X-API-Key"
    }
  },
  "security": [{ "apiKey": [] }]
}
```

**When to use**: Internal services, development environments, low-risk agents, prototyping. API keys are fine when you control both the caller and the agent, and the blast radius of a leaked key is small.

**When to avoid**: Any agent exposed to the internet. Any agent processing sensitive data. Any agent where you need per-caller permissions or audit trails.

**Rotation pattern**: Rotate keys on a fixed schedule (90 days maximum). Support two active keys simultaneously during rotation windows so you don't break callers mid-deploy.

```python
import hashlib
import secrets
from datetime import datetime, timedelta

class APIKeyManager:
    def __init__(self):
        self.active_keys: dict[str, datetime] = {}

    def generate_key(self, ttl_days: int = 90) -> str:
        key = secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        self.active_keys[key_hash] = datetime.utcnow() + timedelta(days=ttl_days)
        return key

    def validate_key(self, key: str) -> bool:
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        expiry = self.active_keys.get(key_hash)
        if expiry is None:
            return False
        if datetime.utcnow() > expiry:
            del self.active_keys[key_hash]
            return False
        return True

    def rotate(self, ttl_days: int = 90) -> str:
        """Generate new key. Old keys remain valid until they expire."""
        return self.generate_key(ttl_days)
```

Store key hashes, not raw keys. If your key store is compromised, the attacker gets hashes they can't use. The raw key exists only at generation time and in the caller's configuration.

### Bearer Tokens (JWT)

JWTs carry claims -- caller identity, permissions, expiry -- in a signed token. The agent validates the signature and claims without calling an external service on every request.

```json
{
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  },
  "security": [{ "bearer": [] }]
}
```

**JWT validation middleware** -- this is the implementation you'll use in production:

```python
import jwt
from functools import wraps
from flask import request, jsonify, g
from datetime import datetime, timezone

JWKS_URL = "https://auth.example.com/.well-known/jwks.json"
EXPECTED_ISSUER = "https://auth.example.com"
EXPECTED_AUDIENCE = "https://agent.example.com"

# Cache the JWKS client to avoid fetching keys on every request
from jwt import PyJWKClient
jwks_client = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=3600)


def require_auth(required_scopes=None):
    """JWT validation middleware for A2A agent endpoints.

    Validates signature, expiry, issuer, audience, and optionally scopes.
    Rejects tokens that fail any check.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return jsonify({"error": "Missing or malformed Authorization header"}), 401

            token = auth_header.split(" ", 1)[1]

            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "ES256"],
                    issuer=EXPECTED_ISSUER,
                    audience=EXPECTED_AUDIENCE,
                    options={
                        "require": ["exp", "iss", "aud", "sub"],
                        "verify_exp": True,
                        "verify_iss": True,
                        "verify_aud": True,
                    },
                )
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Token expired"}), 401
            except jwt.InvalidIssuerError:
                return jsonify({"error": "Invalid token issuer"}), 401
            except jwt.InvalidAudienceError:
                return jsonify({"error": "Invalid token audience"}), 401
            except jwt.PyJWTError as e:
                return jsonify({"error": "Token validation failed"}), 401

            # Scope validation
            if required_scopes:
                token_scopes = set(payload.get("scope", "").split())
                if not token_scopes.issuperset(required_scopes):
                    return jsonify({"error": "Insufficient scope"}), 403

            g.caller_id = payload.get("sub")
            g.caller_scopes = payload.get("scope", "").split()
            return f(*args, **kwargs)

        return decorated_function
    return decorator


# Usage on A2A task endpoint
@app.route("/a2a", methods=["POST"])
@require_auth(required_scopes={"agent:tasks:write"})
def handle_task():
    caller = g.caller_id
    # Process the A2A task
    return jsonify({"status": "ok"})
```

Key validation rules that are non-negotiable:

- **Always verify the signature**. Never decode without verification. Never set `verify=False`.
- **Always check `exp`**. Accept no token without an expiry claim.
- **Always check `iss`**. Your agent should only accept tokens from issuers it explicitly trusts.
- **Always check `aud`**. The audience must be your agent's identifier. This prevents tokens issued for Agent A from being replayed against Agent B.
- **Use asymmetric algorithms** (RS256, ES256). Symmetric algorithms (HS256) mean the agent and the auth server share a secret, which is a liability.

Token expiry should be short: 15 minutes for access tokens, no more than 1 hour. Short-lived tokens limit the damage window if a token is compromised.

### OAuth2 Client Credentials

This is the standard for machine-to-machine A2A communication. The calling agent authenticates to an authorization server with its own credentials and gets a scoped access token.

```json
{
  "securitySchemes": {
    "oauth2": {
      "type": "oauth2",
      "flows": {
        "clientCredentials": {
          "tokenUrl": "https://auth.example.com/oauth/token",
          "scopes": {
            "agent:tasks:write": "Create and update tasks",
            "agent:tasks:read": "Read task status and artifacts"
          }
        }
      }
    }
  },
  "security": [{ "oauth2": ["agent:tasks:write"] }]
}
```

Here's a complete Python implementation for the calling agent side -- acquiring and caching tokens:

```python
import httpx
import time
from dataclasses import dataclass
from threading import Lock


@dataclass
class CachedToken:
    access_token: str
    expires_at: float
    scopes: list[str]


class OAuth2ClientCredentials:
    """OAuth2 client credentials flow for A2A agent authentication.

    Handles token acquisition, caching, and automatic renewal.
    Tokens are cached until 60 seconds before expiry to avoid
    using tokens that expire during a request.
    """

    def __init__(
        self,
        token_url: str,
        client_id: str,
        client_secret: str,
        scopes: list[str],
    ):
        self.token_url = token_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.scopes = scopes
        self._token_cache: CachedToken | None = None
        self._lock = Lock()

    def get_token(self) -> str:
        """Get a valid access token, refreshing if necessary."""
        with self._lock:
            if self._token_cache and self._token_cache.expires_at > time.time() + 60:
                return self._token_cache.access_token
            return self._fetch_new_token()

    def _fetch_new_token(self) -> str:
        response = httpx.post(
            self.token_url,
            data={
                "grant_type": "client_credentials",
                "scope": " ".join(self.scopes),
            },
            auth=(self.client_id, self.client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10.0,
        )
        response.raise_for_status()
        token_data = response.json()

        self._token_cache = CachedToken(
            access_token=token_data["access_token"],
            expires_at=time.time() + token_data.get("expires_in", 3600),
            scopes=token_data.get("scope", "").split(),
        )
        return self._token_cache.access_token

    def auth_header(self) -> dict[str, str]:
        """Return the Authorization header dict for use in requests."""
        return {"Authorization": f"Bearer {self.get_token()}"}


# Usage: calling another A2A agent
oauth = OAuth2ClientCredentials(
    token_url="https://auth.example.com/oauth/token",
    client_id="agent-a-client-id",
    client_secret="agent-a-client-secret",
    scopes=["agent:tasks:write", "agent:tasks:read"],
)

async def send_task_to_agent(agent_url: str, task_payload: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{agent_url}/a2a",
            json=task_payload,
            headers=oauth.auth_header(),
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()
```

For a deeper walkthrough of OAuth2 with A2A, see [How to Secure A2A Agents with OAuth2](/blog/secure-a2a-agents-oauth2).

### OAuth2 Authorization Code

Use this when a human user initiates the agent interaction through a web application. The user authenticates and grants the application permission to act on their behalf. The application then passes the resulting token when calling the agent.

This is the right flow when:

- A user clicks "Run analysis" in a dashboard, and the dashboard calls an A2A agent
- A chatbot interface triggers agent tasks based on user input
- The agent needs to act with the user's identity and permissions

Do not use this for agent-to-agent calls where no human is involved. That's what client credentials is for.

### Mutual TLS (mTLS)

Both the client and server present certificates. The TLS handshake verifies both parties' identities before any application data is exchanged. This is the strongest authentication scheme available.

```json
{
  "securitySchemes": {
    "mtls": {
      "type": "mutualTLS"
    }
  },
  "security": [{ "mtls": [] }]
}
```

**When to use**: High-security environments, financial services, healthcare, government. Environments where you control the PKI infrastructure. Zero-trust architectures where network location means nothing.

**When to avoid**: Public-facing agents, environments where certificate management is a burden the team can't handle, rapid prototyping.

mTLS is operationally expensive. You need a certificate authority, a process for issuing and revoking client certificates, and infrastructure to distribute them. The security payoff is worth it when the data justifies it.

### OpenID Connect

OIDC adds an identity layer on top of OAuth2. Instead of just getting an access token, the client also gets an ID token that contains verified claims about the caller's identity.

This matters when your agent needs to know *who* is calling, not just *that they're authorized*. The ID token contains standard claims like `sub` (subject), `email`, `name`, and custom claims you define.

Use OIDC when:

- You need to log which specific user or service account triggered each task
- Your agent applies different behavior based on caller identity
- You're integrating with an enterprise identity provider (Okta, Azure AD, Auth0)

## Transport Security

### HTTPS Is Not Optional

Every A2A endpoint must use HTTPS. No exceptions. No "it's just internal" excuses. Agent Cards should reject non-HTTPS URLs at validation time.

```python
from urllib.parse import urlparse

def validate_agent_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"Agent URL must use HTTPS, got {parsed.scheme}")
    if parsed.hostname in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("Agent URL must not point to localhost in production")
    return True
```

### TLS 1.3

Configure your servers to prefer TLS 1.3. It's faster (one fewer round trip in the handshake), more secure (removes obsolete cipher suites), and supported by every modern client.

Disable TLS 1.0 and 1.1 entirely. TLS 1.2 is acceptable as a fallback, but only with strong cipher suites (AES-GCM, ChaCha20-Poly1305). Disable CBC-mode ciphers.

### Certificate Pinning

Certificate pinning -- hardcoding the expected server certificate or public key in the client -- prevents MITM attacks even if a certificate authority is compromised. It's valuable for agent-to-agent calls where both endpoints are under your control.

The tradeoff: certificate rotation becomes a coordinated deployment. If the server gets a new certificate and the client still has the old pin, the connection breaks. Use public key pinning instead of certificate pinning to make rotation easier -- the public key can survive certificate renewal if you reuse the key pair.

For most A2A deployments, standard certificate validation with a trusted CA is sufficient. Reserve pinning for high-security environments.

## Agent Card Security

Your Agent Card is a public document that describes your agent's capabilities. What you put in it matters.

### Public vs. Extended Cards

The A2A specification supports the concept of extended Agent Cards -- additional capability information returned only to authenticated callers. Use this.

Your public card (at `/.well-known/agent-card.json`) should contain the minimum viable information: name, description, version, authentication requirements, and a limited set of public skills.

Internal skills -- administrative functions, debugging endpoints, data migration tools -- should only appear in the extended card, served after the caller authenticates and proves they have the appropriate scope.

```python
def get_agent_card(request):
    base_card = {
        "name": "Data Analysis Agent",
        "description": "Analyzes datasets and produces reports",
        "url": "https://agent.example.com",
        "version": "1.0.0",
        "capabilities": {"streaming": True},
        "skills": [
            {
                "id": "analyze-dataset",
                "name": "Analyze Dataset",
                "description": "Run statistical analysis on a dataset",
            }
        ],
        "securitySchemes": {
            "oauth2": {
                "type": "oauth2",
                "flows": {
                    "clientCredentials": {
                        "tokenUrl": "https://auth.example.com/oauth/token",
                        "scopes": {"agent:tasks:write": "Create tasks"}
                    }
                }
            }
        },
        "security": [{"oauth2": ["agent:tasks:write"]}],
    }

    # Only expose internal skills to authenticated, privileged callers
    if is_authenticated(request) and has_scope(request, "agent:admin"):
        base_card["skills"].extend([
            {
                "id": "flush-cache",
                "name": "Flush Cache",
                "description": "Clear all cached analysis results",
            },
            {
                "id": "export-logs",
                "name": "Export Logs",
                "description": "Export agent processing logs",
            },
        ])

    return base_card
```

Validate your Agent Card with the [Agent Card Validator](/tools/agent-card-validator) before deploying. A misconfigured card can expose internal capabilities or break client compatibility.

For more on securing agent discovery, see [A2A Agent Discovery: Security Best Practices](/blog/a2a-agent-discovery-security).

## Input Validation

### Don't Trust Other Agents

This is the single most important rule in multi-agent security. The calling agent is an HTTP client. Its input is user input. Validate everything.

- **Content type validation**: Check that the message parts have expected content types. If your skill expects `text/plain`, reject `application/octet-stream`. If it expects JSON, parse and validate the schema before processing.
- **Size limits**: Set maximum payload sizes. A message part containing 500MB of text is not a legitimate request -- it's a denial-of-service attempt or a misconfigured client.
- **Schema validation**: Use strict schemas for structured inputs. Define expected fields, types, and value ranges. Reject anything that doesn't match.

```python
from pydantic import BaseModel, validator, constr
from typing import Literal

class TaskMessagePart(BaseModel):
    type: Literal["text", "file", "data"]
    content: constr(max_length=100_000)  # 100KB max text content
    mimeType: str = "text/plain"

    @validator("mimeType")
    def validate_mime_type(cls, v):
        allowed = {"text/plain", "application/json", "text/csv"}
        if v not in allowed:
            raise ValueError(f"Unsupported content type: {v}. Allowed: {allowed}")
        return v

class IncomingTask(BaseModel):
    jsonrpc: Literal["2.0"]
    method: Literal["tasks/send", "tasks/sendSubscribe"]
    id: str
    params: dict

    @validator("id")
    def validate_id_length(cls, v):
        if len(v) > 128:
            raise ValueError("Task ID too long")
        return v
```

### Sanitize for Downstream Consumption

If your agent processes input and passes it to another system -- a database, an API, another agent -- sanitize it for that context. Don't pass raw user input into SQL queries, shell commands, or downstream agent prompts without escaping or parameterization.

This is standard injection prevention, but it's worth repeating because agent chains create new injection surfaces. Input that's safe for your agent might be dangerous for the next agent in the chain.

## Output Security

### Don't Leak Internal State

Your agent's error messages, debugging output, and verbose responses are all potential information leaks. Every piece of internal state you expose helps an attacker understand your infrastructure.

Bad:

```json
{
  "error": "PostgreSQL connection failed: host=db-prod-3.internal.example.com port=5432 user=agent_svc password=*** dbname=analytics"
}
```

Good:

```json
{
  "error": "Internal processing error. Request ID: req_abc123. Contact support if the issue persists."
}
```

Rules for error messages in production:

- Never include hostnames, IP addresses, or connection strings
- Never include stack traces or file paths
- Never include SQL queries or database schema information
- Always include a request ID so you can correlate with internal logs
- Keep messages generic for the caller, detailed in your internal logs

### Artifact Security

When your agent produces artifacts (files, documents, data), validate that the artifact doesn't contain data the caller shouldn't have access to. If your agent processes data from multiple tenants, ensure tenant isolation in outputs.

## Multi-Hop Security

Agent chains -- where Agent A calls Agent B, which calls Agent C -- create unique security challenges. Every hop is a trust boundary.

### Don't Blindly Forward Credentials

When Agent A sends a bearer token to Agent B, and Agent B needs to call Agent C, Agent B should **not** forward Agent A's token. That token was issued for the Agent A -> Agent B relationship. Agent B should authenticate to Agent C with its own credentials.

```python
# WRONG: Forwarding the caller's token
async def handle_task(request):
    caller_token = request.headers.get("Authorization")
    # Don't do this -- you're impersonating the caller
    response = await call_agent_c(token=caller_token)

# RIGHT: Using your own credentials
async def handle_task(request):
    # Validate caller's token
    caller = validate_token(request.headers.get("Authorization"))
    # Use YOUR credentials to call downstream agents
    my_token = oauth_client.get_token()
    response = await call_agent_c(token=my_token)
```

If Agent C needs to know who originally triggered the chain, pass that as a claim in the task payload, not by forwarding credentials. This is the "on-behalf-of" pattern.

### Trust Propagation

Define clear trust boundaries. Not every agent in a chain needs the same level of access. Use scoped tokens: Agent B might have `tasks:write` on Agent C, but not `admin:read`. The scope should reflect the minimum permissions needed for the specific downstream call.

### Input Re-validation at Every Hop

Each agent in a chain must validate its inputs independently. Don't assume that because Agent A validated the original request, the data arriving at Agent C is safe. Agent B might have transformed it, appended to it, or introduced new content.

## Rate Limiting and Abuse Prevention

Every A2A agent needs rate limiting. Without it, a single misconfigured client -- or an attacker -- can exhaust your resources.

Here's a token bucket implementation with per-caller tracking:

```python
import time
from collections import defaultdict
from threading import Lock
from functools import wraps
from flask import request, jsonify


class TokenBucketRateLimiter:
    """Per-caller rate limiter using the token bucket algorithm.

    Each caller gets a bucket that fills at `rate` tokens per second,
    up to `capacity`. Each request consumes one token. When the bucket
    is empty, requests are rejected with 429.
    """

    def __init__(self, rate: float = 10.0, capacity: int = 50):
        self.rate = rate          # Tokens added per second
        self.capacity = capacity  # Maximum burst size
        self._buckets: dict[str, dict] = defaultdict(
            lambda: {"tokens": capacity, "last_refill": time.monotonic()}
        )
        self._lock = Lock()

    def allow(self, caller_id: str) -> bool:
        with self._lock:
            bucket = self._buckets[caller_id]
            now = time.monotonic()
            elapsed = now - bucket["last_refill"]

            # Refill tokens based on elapsed time
            bucket["tokens"] = min(
                self.capacity,
                bucket["tokens"] + elapsed * self.rate,
            )
            bucket["last_refill"] = now

            if bucket["tokens"] >= 1.0:
                bucket["tokens"] -= 1.0
                return True
            return False


rate_limiter = TokenBucketRateLimiter(rate=10.0, capacity=50)


def rate_limit(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Identify caller by authenticated subject or IP as fallback
        caller_id = getattr(request, "caller_id", None) or request.remote_addr
        if not rate_limiter.allow(caller_id):
            return jsonify({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32000,
                    "message": "Rate limit exceeded. Retry after a brief delay.",
                },
            }), 429
        return f(*args, **kwargs)
    return decorated


@app.route("/a2a", methods=["POST"])
@require_auth(required_scopes={"agent:tasks:write"})
@rate_limit
def handle_task():
    # Process the A2A task
    return jsonify({"status": "ok"})
```

Rate limiting by caller identity (the `sub` claim from the JWT) is better than by IP address. Agents behind a load balancer or NAT share IPs, and IP-based limiting will produce false positives. Use the authenticated identity when available, fall back to IP when it's not.

Set different rate limits for different operations. Reading task status is cheap; creating new tasks is expensive. Streaming endpoints need connection count limits in addition to request rate limits.

## Monitoring and Audit Logging

You can't secure what you can't see. Every A2A agent must produce structured audit logs that answer: who did what, when, and what happened.

```python
import json
import logging
import uuid
from datetime import datetime, timezone
from functools import wraps
from flask import request, g

# Structured JSON logger
audit_logger = logging.getLogger("a2a.audit")
audit_handler = logging.StreamHandler()
audit_handler.setFormatter(logging.Formatter("%(message)s"))
audit_logger.addHandler(audit_handler)
audit_logger.setLevel(logging.INFO)


def audit_log(event_type: str, details: dict = None):
    """Emit a structured audit log entry."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event_type,
        "request_id": getattr(g, "request_id", "unknown"),
        "caller_id": getattr(g, "caller_id", "anonymous"),
        "caller_ip": request.remote_addr if request else None,
        "method": request.method if request else None,
        "path": request.path if request else None,
        "details": details or {},
    }
    audit_logger.info(json.dumps(entry, default=str))


def with_audit(event_type: str):
    """Decorator that wraps an endpoint with audit logging."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            g.request_id = str(uuid.uuid4())
            audit_log(f"{event_type}.started")

            try:
                result = f(*args, **kwargs)
                audit_log(f"{event_type}.completed", {
                    "status_code": result[1] if isinstance(result, tuple) else 200,
                })
                return result
            except Exception as e:
                audit_log(f"{event_type}.failed", {
                    "error_type": type(e).__name__,
                    # Don't log the full error message -- it might contain sensitive data
                    "error_category": "internal_error",
                })
                raise

        return decorated
    return decorator


# Usage
@app.route("/a2a", methods=["POST"])
@require_auth(required_scopes={"agent:tasks:write"})
@rate_limit
@with_audit("task.execute")
def handle_task():
    task_data = request.get_json()
    task_method = task_data.get("method", "unknown")
    audit_log("task.processing", {"method": task_method})
    # Process task...
    return jsonify({"status": "ok"})
```

Every audit log entry should include:

- **Timestamp** in UTC (ISO 8601)
- **Request ID** for correlation
- **Caller identity** from the authenticated token
- **Source IP** for forensic analysis
- **Operation** that was attempted
- **Outcome** (success, failure, denied)
- **Relevant metadata** (task method, skill invoked, not the full payload)

Never log full request or response payloads in audit logs. They contain sensitive data. Log enough metadata to reconstruct what happened without storing the data itself.

Send audit logs to a centralized system (ELK stack, Datadog, CloudWatch, Loki) where they can be searched, alerted on, and retained according to your compliance requirements.

### What to Alert On

Set up alerts for these patterns:

- **Authentication failures** exceeding a threshold (brute force attempt)
- **Authorization failures** (caller trying operations outside their scope)
- **Rate limit hits** from a single caller (abuse or misconfiguration)
- **Error rate spikes** (something is broken or under attack)
- **Unusual call patterns** (a caller that normally sends 10 tasks/day suddenly sending 10,000)

## Production Deployment Checklist

Before deploying any A2A agent to production, verify every item on this list. No exceptions.

### Authentication and Authorization

- [ ] Authentication is required on all endpoints (no anonymous access)
- [ ] OAuth2 client credentials or mTLS is configured for agent-to-agent calls
- [ ] JWT validation checks signature, expiry, issuer, and audience
- [ ] Scopes are defined and enforced per skill
- [ ] API keys (if used) have expiry dates and rotation schedules
- [ ] Token expiry is 15 minutes or less for access tokens
- [ ] Service account credentials are stored in a secrets manager, not in code or environment variables

### Transport Security

- [ ] HTTPS is enforced on all endpoints (HTTP requests are rejected or redirected)
- [ ] TLS 1.2+ only (TLS 1.0 and 1.1 disabled)
- [ ] Strong cipher suites only (AES-GCM, ChaCha20-Poly1305)
- [ ] Certificates are from a trusted CA (not self-signed in production)
- [ ] Certificate renewal is automated (Let's Encrypt, ACM, or equivalent)

### Agent Card

- [ ] Agent Card is served over HTTPS
- [ ] Public card exposes only public skills
- [ ] Internal/admin skills are behind authentication in extended card
- [ ] Agent Card is validated with the [Agent Card Validator](/tools/agent-card-validator)
- [ ] Security schemes are correctly declared
- [ ] Agent Card URL is not guessable for agents that should not be publicly discoverable

### Input and Output

- [ ] All incoming task payloads are validated against a strict schema
- [ ] Content type validation is enforced
- [ ] Maximum payload size is configured
- [ ] Error messages don't leak internal state (no stack traces, no hostnames, no connection strings)
- [ ] Artifacts are checked for data leakage before returning

### Operational Security

- [ ] Rate limiting is configured per caller
- [ ] Structured audit logging is enabled
- [ ] Logs are sent to a centralized logging system
- [ ] Alerts are configured for auth failures, rate limit hits, and error spikes
- [ ] A runbook exists for incident response
- [ ] Dependencies are pinned and regularly scanned for vulnerabilities

### Multi-Agent Chains

- [ ] Downstream calls use the agent's own credentials, not forwarded tokens
- [ ] Input is re-validated at every hop in the chain
- [ ] Scopes for downstream calls follow the principle of least privilege
- [ ] Chain depth is limited to prevent infinite loops

Browse [security and auth agents](/agents/category/security-auth) for pre-built agents that handle authentication, authorization, and security scanning in A2A deployments.

## Final Thoughts

Security in A2A is not a feature you add later. It's a property of the system that exists from the first deployment or doesn't exist at all. The protocol gives you the primitives -- `securitySchemes`, `security`, transport-level protections -- but you have to use them.

The agents that get compromised are not the ones with sophisticated attack surfaces. They're the ones deployed on a Friday afternoon without authentication because "we'll add it next sprint." That sprint never comes.

Start with OAuth2 client credentials. Add JWT validation. Configure rate limiting. Set up audit logs. Run through the checklist. Then ship.
