---
title: "How to Secure A2A Agents with OAuth2"
description: "Implementing OAuth2 for A2A agents: client credentials flow, token validation, Agent Card security schemes, and what actually matters in production."
date: "2026-02-20"
readingTime: 8
tags: ["a2a", "security", "oauth2", "guide"]
relatedStacks: ["security-auth"]
relatedAgents: ["a2a-sample-headless-agent-auth", "a2a-sample-magic-8-ball-security", "a2a-sample-signing-and-verifying"]
---

A2A agents are HTTP services. An unprotected agent is an open API. Anyone with the URL can call it, and Agent Cards at `/.well-known/agent-card.json` make that URL trivially discoverable. OAuth2 is how you lock it down.

## Why This Is Non-Negotiable

A2A agents are remote by design. Unlike MCP servers that often run locally over stdio, A2A agents sit on a network and accept HTTP requests from anywhere.

- Any HTTP client can call your agent if it knows the URL
- Agent Cards are publicly discoverable
- Tasks regularly contain sensitive data -- financial records, PII, proprietary code
- Agents perform real actions -- database writes, paid API calls, email sends

Deploying an A2A agent without auth is deploying a REST API without auth. Don't.

## Client Credentials Flow

For agent-to-agent communication, use client credentials. There's no human in the loop. The calling agent authenticates with its own identity.

```
Agent A                  Auth Server              Agent B
   |                         |                       |
   |-- Request Token ------->|                       |
   |   (client_id, secret)   |                       |
   |                         |                       |
   |<-- Access Token --------|                       |
   |                         |                       |
   |-- A2A Request + Token ----------------------->|
   |                         |                       |
   |                         |<-- Validate Token ----|
   |                         |                       |
   |                         |-- Token Valid -------->|
   |                         |                       |
   |<-- A2A Response --------------------------------|
```

Authorization code flow exists for when a human triggers an agent interaction through a web app. For machine-to-machine, client credentials is the right choice.

## Agent Card Security Configuration

Declare your auth requirements in the Agent Card. Clients that discover your agent will know how to authenticate before making a single request.

```json
{
  "name": "Expense Reimbursement Agent",
  "description": "Handles expense submission and approval",
  "url": "https://expense-agent.example.com",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "securitySchemes": {
    "oauth2": {
      "type": "oauth2",
      "flows": {
        "clientCredentials": {
          "tokenUrl": "https://auth.example.com/oauth2/token",
          "scopes": {
            "agent:read": "Read agent data and task status",
            "agent:execute": "Execute tasks on this agent",
            "agent:admin": "Manage agent configuration"
          }
        }
      }
    }
  },
  "security": [
    {
      "oauth2": ["agent:execute"]
    }
  ],
  "skills": [
    {
      "id": "submit-expense",
      "name": "Submit Expense",
      "description": "Submit an expense for reimbursement"
    }
  ]
}
```

`securitySchemes` defines the available auth methods. `security` at the top level sets the default requirement for all endpoints. Define granular scopes -- `agent:read` vs `agent:execute` vs `agent:admin` -- don't use a single "access everything" scope.

## Token Validation

Here's how to validate OAuth2 tokens in a Python A2A agent.

### The Validator

```python
import jwt
from jwt import PyJWKClient
from functools import wraps

class TokenValidator:
    def __init__(self, issuer: str, jwks_url: str, audience: str):
        self.issuer = issuer
        self.audience = audience
        self.jwks_client = PyJWKClient(jwks_url)

    def validate(self, token: str) -> dict:
        """Validate an OAuth2 access token and return its claims."""
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=self.audience,
            issuer=self.issuer,
        )

        return claims

    def has_scope(self, claims: dict, required_scope: str) -> bool:
        """Check if the token has the required scope."""
        token_scopes = claims.get("scope", "").split(" ")
        return required_scope in token_scopes
```

### Auth Middleware

```python
from starlette.requests import Request
from starlette.responses import JSONResponse

validator = TokenValidator(
    issuer="https://auth.example.com",
    jwks_url="https://auth.example.com/.well-known/jwks.json",
    audience="https://expense-agent.example.com",
)

async def auth_middleware(request: Request, call_next):
    # Skip auth for the agent card endpoint
    if request.url.path == "/.well-known/agent-card.json":
        return await call_next(request)

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"error": "Missing or invalid Authorization header"}
        )

    token = auth_header.split("Bearer ")[1]

    try:
        claims = validator.validate(token)
    except jwt.InvalidTokenError as e:
        return JSONResponse(
            status_code=401,
            content={"error": f"Invalid token: {str(e)}"}
        )

    # Check required scope
    if not validator.has_scope(claims, "agent:execute"):
        return JSONResponse(
            status_code=403,
            content={"error": "Insufficient scope. Required: agent:execute"}
        )

    # Attach claims to request state for downstream use
    request.state.auth_claims = claims
    return await call_next(request)
```

### The Calling Agent

The agent making the request obtains a token before calling:

```python
import httpx

class A2AAuthClient:
    def __init__(self, token_url: str, client_id: str, client_secret: str):
        self.token_url = token_url
        self.client_id = client_id
        self.client_secret = client_secret
        self._token = None

    async def get_token(self) -> str:
        """Obtain an access token using client credentials."""
        async with httpx.AsyncClient() as http:
            response = await http.post(
                self.token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": "agent:execute",
                },
            )
            response.raise_for_status()
            self._token = response.json()["access_token"]
            return self._token

    async def send_task(self, agent_url: str, message: dict) -> dict:
        """Send an A2A task with OAuth2 authentication."""
        token = await self.get_token()

        async with httpx.AsyncClient() as http:
            response = await http.post(
                f"{agent_url}/tasks/send",
                json={"message": message},
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            return response.json()
```

## Official Security Samples

Three samples from the A2A project worth reading:

- [Headless Agent Auth](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/headless_agent_auth) -- Authentication for agents without a UI. The pattern you need for backend services that authenticate programmatically.
- [Magic 8 Ball Security](https://github.com/a2aproject/a2a-samples/tree/main/samples/java/agents/magic_8_ball_security) -- Java implementation with real security patterns: token validation and access control.
- [Signing and Verifying](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/signing_and_verifying) -- Cryptographic message signing and verification. Goes beyond OAuth2 to ensure message integrity across trust boundaries.

## Production Checklist

- **Validate on the agent side.** Never trust that a gateway or proxy has validated the token. Your agent validates every request independently.
- **Use short-lived tokens.** 15-30 minutes for agent-to-agent communication. Implement token refresh in your client.
- **Scope permissions granularly.** Per-skill scopes: `expense:submit`, `expense:approve`, `expense:read`. Not one scope for everything.
- **Rotate client secrets.** Automate it. Never hardcode secrets. Use environment variables or a secrets manager.
- **Log auth events.** Every success and failure, with the client ID. Never log the token itself. You need this audit trail for incident response.
- **Use mTLS for internal agents.** For agents communicating within your infrastructure, mutual TLS provides stronger guarantees than OAuth2 alone. Combine them: mTLS for transport, OAuth2 for authorization.
- **Rate-limit the Agent Card endpoint.** It's public. Monitor access patterns. An attacker who maps your agent's capabilities can craft more targeted attacks.
