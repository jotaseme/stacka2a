---
title: "A2A Agent Authentication: From API Keys to OAuth2"
description: "Progressive authentication guide for A2A agents. Start with API keys, move to JWT Bearer tokens, graduate to OAuth2 client credentials. Working code for each level."
date: "2026-03-18"
readingTime: 10
tags: ["a2a", "authentication", "security", "oauth2"]
relatedStacks: []
relatedAgents: []
---

A2A agents are HTTP services. If your agent is reachable over a network, it needs authentication. The question is not whether, but which mechanism fits your current stage.

This guide walks through three levels of auth, each appropriate for a different context. Start simple. Graduate when you need to.

## The three levels

| Level | Mechanism | When to use |
|-------|-----------|-------------|
| 1 | API Key | Internal agents, prototypes, single-team |
| 2 | JWT Bearer | Multi-team, service mesh, token-based infra |
| 3 | OAuth2 Client Credentials | Cross-org, production multi-agent, compliance |

Each level builds on the previous. The code patterns are additive -- you can evolve from Level 1 to Level 3 without rewriting your agent.

## Level 1: API Key

The simplest authentication: a shared secret in a request header. Good for internal agents where you control both sides.

### Agent Card declaration

```json
{
  "name": "Internal Analytics Agent",
  "url": "https://analytics.internal.example.com",
  "version": "1.0.0",
  "capabilities": { "streaming": true },
  "securitySchemes": {
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "X-API-Key"
    }
  },
  "security": [{ "apiKey": [] }],
  "skills": [
    {
      "id": "analyze",
      "name": "Data Analysis",
      "description": "Analyzes datasets and returns statistical summaries"
    }
  ]
}
```

The `securitySchemes` block tells any client discovering your agent: "send an API key in the `X-API-Key` header." This follows the [OpenAPI security scheme format](/blog/a2a-agent-card-explained) that A2A adopts.

### Server-side validation

```python
# middleware_apikey.py
import os
import hashlib
import hmac
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

VALID_API_KEYS = {
    # Store hashed keys, not plaintext
    hashlib.sha256(os.environ["AGENT_API_KEY_1"].encode()).hexdigest(): "client-a",
    hashlib.sha256(os.environ["AGENT_API_KEY_2"].encode()).hexdigest(): "client-b",
}


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Agent Card is always public
        if request.url.path == "/.well-known/agent-card.json":
            return await call_next(request)

        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return JSONResponse(
                status_code=401,
                content={
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32001,
                        "message": "Missing X-API-Key header",
                    },
                },
            )

        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        client_id = VALID_API_KEYS.get(key_hash)
        if not client_id:
            return JSONResponse(
                status_code=401,
                content={
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32001,
                        "message": "Invalid API key",
                    },
                },
            )

        request.state.client_id = client_id
        return await call_next(request)
```

Key points:
- Never store plaintext API keys. Hash them with SHA-256 and compare hashes.
- Always skip auth for `/.well-known/agent-card.json`. Clients need to discover your agent before they can authenticate.
- Return JSON-RPC formatted errors so clients parse them consistently.

### Client-side usage

```python
import httpx

async def call_agent(agent_url: str, message: str, api_key: str) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": message}],
            }
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            agent_url,
            json=payload,
            headers={"X-API-Key": api_key},
        )
        resp.raise_for_status()
        return resp.json()
```

### When API keys break down

API keys become a liability when:
- Multiple teams need different permission levels (API keys are all-or-nothing)
- You need to rotate keys across many clients without downtime
- Audit requirements demand knowing which specific service made a request, with verifiable identity
- Keys leak in logs, environment variables, or commit history

That is when you move to Level 2.

## Level 2: JWT Bearer tokens

JWT tokens carry claims -- identity, scopes, expiration -- inside the token itself. The server validates the signature and reads the claims without calling an external service on every request.

### Agent Card declaration

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

### Token validation middleware

```python
# middleware_jwt.py
import jwt
from jwt import PyJWKClient
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class JWTMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, issuer: str, jwks_url: str, audience: str):
        super().__init__(app)
        self.issuer = issuer
        self.audience = audience
        self.jwks_client = PyJWKClient(jwks_url, cache_keys=True)

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/.well-known/agent-card.json":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={
                    "jsonrpc": "2.0",
                    "error": {"code": -32001, "message": "Missing Bearer token"},
                },
            )

        token = auth_header[7:]  # Strip "Bearer "

        try:
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=self.audience,
                issuer=self.issuer,
                options={"require": ["exp", "iss", "aud", "sub"]},
            )
        except jwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=401,
                content={
                    "jsonrpc": "2.0",
                    "error": {"code": -32001, "message": "Token expired"},
                },
            )
        except jwt.InvalidTokenError as e:
            return JSONResponse(
                status_code=401,
                content={
                    "jsonrpc": "2.0",
                    "error": {"code": -32001, "message": f"Invalid token: {e}"},
                },
            )

        request.state.claims = claims
        request.state.client_id = claims.get("sub", "unknown")
        return await call_next(request)
```

### Scope checking

JWTs can carry scopes, letting you enforce fine-grained permissions per skill:

```python
def require_scope(required: str):
    """Dependency that checks for a required OAuth2 scope in the JWT."""
    def checker(request: Request):
        claims = getattr(request.state, "claims", {})
        scopes = claims.get("scope", "").split()
        if required not in scopes:
            return JSONResponse(
                status_code=403,
                content={
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32003,
                        "message": f"Missing required scope: {required}",
                    },
                },
            )
        return None
    return checker
```

Use it in your request handler:

```python
async def handle_task(request: Request):
    # Check scope before processing
    error = require_scope("agent:execute")(request)
    if error:
        return error

    # Process the A2A request...
```

## Level 3: OAuth2 Client Credentials

The full solution for production multi-agent systems. An authorization server issues short-lived tokens. Agents authenticate with client credentials, receive scoped tokens, and use them for inter-agent calls.

### Agent Card declaration

```json
{
  "securitySchemes": {
    "oauth2": {
      "type": "oauth2",
      "flows": {
        "clientCredentials": {
          "tokenUrl": "https://auth.example.com/oauth2/token",
          "scopes": {
            "agent:read": "Read task status and agent metadata",
            "agent:execute": "Submit and manage tasks",
            "agent:admin": "Configure agent settings"
          }
        }
      }
    }
  },
  "security": [{ "oauth2": ["agent:execute"] }],
  "skills": [
    {
      "id": "sensitive-analysis",
      "name": "Sensitive Data Analysis",
      "description": "Analyzes data containing PII",
      "security": [{ "oauth2": ["agent:execute", "data:pii"] }]
    }
  ]
}
```

Note the per-skill security override. The `sensitive-analysis` skill requires an additional `data:pii` scope beyond the default `agent:execute`.

### Client with automatic token management

```python
# oauth2_client.py
import time
import httpx


class OAuth2A2AClient:
    def __init__(
        self,
        token_url: str,
        client_id: str,
        client_secret: str,
        default_scopes: list[str] | None = None,
    ):
        self.token_url = token_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.default_scopes = default_scopes or ["agent:execute"]
        self._token: str | None = None
        self._token_expiry: float = 0

    async def _fetch_token(self, scopes: list[str]) -> str:
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                self.token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": " ".join(scopes),
                },
            )
            resp.raise_for_status()
            data = resp.json()

        self._token = data["access_token"]
        # Refresh 60 seconds before actual expiry
        self._token_expiry = time.time() + data.get("expires_in", 3600) - 60
        return self._token

    async def get_token(self, scopes: list[str] | None = None) -> str:
        scopes = scopes or self.default_scopes
        if self._token and time.time() < self._token_expiry:
            return self._token
        return await self._fetch_token(scopes)

    async def send_task(self, agent_url: str, text: str) -> dict:
        token = await self.get_token()
        payload = {
            "jsonrpc": "2.0",
            "id": "1",
            "method": "message/send",
            "params": {
                "message": {
                    "role": "user",
                    "parts": [{"type": "text", "text": text}],
                }
            },
        }
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                agent_url,
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=60,
            )
            resp.raise_for_status()
            return resp.json()

    async def discover_and_call(self, base_url: str, text: str) -> dict:
        """Full flow: discover agent, check auth requirements, get token, call."""
        async with httpx.AsyncClient() as http:
            # Step 1: Discover
            card_resp = await http.get(
                f"{base_url}/.well-known/agent-card.json"
            )
            card = card_resp.json()

            # Step 2: Extract token URL and scopes from the card
            oauth_scheme = card.get("securitySchemes", {}).get("oauth2", {})
            flows = oauth_scheme.get("flows", {})
            cc_flow = flows.get("clientCredentials", {})
            token_url = cc_flow.get("tokenUrl", self.token_url)
            available_scopes = list(cc_flow.get("scopes", {}).keys())

            # Step 3: Get required scopes from security field
            security = card.get("security", [{}])
            required_scopes = security[0].get("oauth2", available_scopes[:1])

            # Step 4: Get token and call
            self.token_url = token_url
            token = await self.get_token(required_scopes)

            return await self.send_task(card["url"], text)
```

The `discover_and_call` method shows the full automated flow: read the Agent Card, extract auth requirements, obtain a token with the right scopes, call the agent. This is what a well-built orchestrator does.

### Wiring it into a Starlette A2A server

```python
# server.py
from starlette.applications import Starlette
from starlette.routing import Route
from middleware_jwt import JWTMiddleware

app = Starlette(
    routes=[
        Route("/.well-known/agent-card.json", agent_card_handler),
        Route("/", a2a_handler, methods=["POST"]),
    ],
)

# The JWT middleware validates OAuth2 access tokens
# (they are JWTs signed by the auth server)
app.add_middleware(
    JWTMiddleware,
    issuer="https://auth.example.com",
    jwks_url="https://auth.example.com/.well-known/jwks.json",
    audience="https://my-agent.example.com",
)
```

The same JWT middleware from Level 2 validates OAuth2 tokens. OAuth2 client credentials tokens are JWTs -- the middleware does not change, only the way clients obtain their tokens does.

## Decision guide

**Use API keys when:**
- You are prototyping or building internal tools
- Both sides are controlled by the same team
- You have fewer than 5 calling clients
- Compliance is not a concern

**Use JWT Bearer when:**
- Multiple teams consume your agent
- You already have a JWT-issuing identity provider
- You need scoped permissions
- You want stateless validation (no database lookup per request)

**Use OAuth2 Client Credentials when:**
- Agents communicate across organizational boundaries
- You need auditable, rotatable, scoped credentials
- Compliance requires a formal authorization server
- Your multi-agent system involves agents from different vendors

## Common mistakes

- **Skipping auth on internal agents.** Internal networks get breached. Zero-trust means every agent authenticates, even behind a VPN.
- **Logging tokens.** Log the client ID, the scopes, the request. Never the token itself.
- **Long-lived tokens.** 15 minutes for machine-to-machine. If your tokens last 24 hours, you have a 24-hour window of compromise.
- **One scope for everything.** Define `agent:read`, `agent:execute`, `agent:admin` at minimum. Per-skill scopes when the stakes are high.
- **Hardcoding secrets.** Use environment variables or a secrets manager. Never commit credentials to source control.

## Further reading

- [How to Secure A2A Agents with OAuth2](/blog/secure-a2a-agents-oauth2) -- deeper dive on OAuth2 specifics
- [A2A Agent Cards](/blog/a2a-agent-card-explained) -- the full security scheme declaration format
- [A2A Agent Discovery and Security](/blog/a2a-agent-discovery-security) -- discovery-layer security concerns
- Browse agents and their auth patterns on [StackA2A](/agents)
