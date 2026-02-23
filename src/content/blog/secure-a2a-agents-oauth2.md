---
title: "How to Secure A2A Agents with OAuth2"
description: "A step-by-step guide to implementing OAuth2 authentication for A2A agents. Covers client credentials flow, token validation, Agent Card security schemes, and production best practices."
date: "2026-02-22"
readingTime: 9
tags: ["a2a", "security", "oauth2", "guide"]
relatedStacks: ["security-auth"]
---

A2A agents communicate over HTTP, which means they inherit all the security concerns of any HTTP-based service. An unprotected agent is an open API that anyone can call. In production, you need authentication, authorization, and token validation. OAuth2 is the standard answer.

This guide walks through implementing OAuth2 for A2A agents, from configuring security schemes in Agent Cards to validating tokens in your agent code.

## Why Security Matters for Remote Agents

A2A agents are fundamentally different from MCP servers in one critical way: they are designed to be remote. While an MCP server often runs locally over stdio, an A2A agent runs on a server and accepts HTTP requests from the network.

This means:

- **Any HTTP client can call your agent** if it knows the URL
- **Agent Cards are publicly discoverable** at `/.well-known/agent-card.json`
- **Tasks may contain sensitive data** (financial records, personal information, proprietary code)
- **Agents may perform actions** (modifying databases, calling paid APIs, sending emails)

Without authentication, deploying an A2A agent is like deploying a REST API with no auth. Do not do it.

## OAuth2 Flows for A2A

The A2A spec supports OAuth2 security schemes in Agent Cards. The two most relevant flows for agent-to-agent communication are:

### Client Credentials Flow (Recommended for Agents)

This is the right flow when one agent calls another agent. There is no human in the loop. The calling agent authenticates with its own credentials.

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

### Authorization Code Flow (For Human-Initiated Requests)

Use this when a human user triggers an agent interaction through a web application. The user authenticates via a browser redirect, and the resulting token is passed to the agent.

For most agent-to-agent scenarios, client credentials is the right choice.

## Configuring the Agent Card

The Agent Card is where you declare your agent's security requirements. Any client that discovers your agent will know how to authenticate before making a request.

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

Key points:

- `securitySchemes` defines the available authentication methods
- `security` at the top level sets the default requirement for all endpoints
- Scopes let you define granular permissions (`agent:read` vs `agent:execute` vs `agent:admin`)

## Implementing Token Validation

Here is how to validate OAuth2 tokens in a Python A2A agent using Google ADK patterns.

### Step 1: Set Up the Token Validator

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

### Step 2: Add Auth Middleware to Your Agent

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

### Step 3: Configure the Calling Agent

The agent making the request needs to obtain a token before calling:

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

## Learning from Official Samples

The A2A project provides two official security-focused samples worth studying:

### Headless Agent Auth

The [Headless Agent Auth](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/headless_agent_auth) sample demonstrates authentication for agents that run without a UI. This is the pattern you need for backend service agents that authenticate programmatically.

### Magic 8 Ball Security

The [Magic 8 Ball Security](https://github.com/a2aproject/a2a-samples/tree/main/samples/java/agents/magic_8_ball_security) sample is a Java implementation that shows how to add security to a simple agent. Despite the playful name, it demonstrates real security patterns including token validation and access control.

### Signing and Verifying

The [Signing and Verifying](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/signing_and_verifying) sample shows how to cryptographically sign A2A messages and verify their authenticity. This goes beyond OAuth2 to ensure message integrity, which is critical when agents communicate across trust boundaries.

## Production Best Practices

### 1. Always Validate on the Agent Side

Never trust that a gateway or proxy has validated the token. Your agent should validate every request independently.

### 2. Use Short-Lived Tokens

Set token expiration to 15-30 minutes for agent-to-agent communication. Implement token refresh in your client.

### 3. Scope Your Permissions

Do not use a single "access everything" scope. Define granular scopes per skill:

```json
{
  "scopes": {
    "expense:submit": "Submit new expenses",
    "expense:approve": "Approve or reject expenses",
    "expense:read": "View expense history"
  }
}
```

### 4. Rotate Client Secrets

Automate client secret rotation. Never hardcode secrets in agent code. Use environment variables or a secrets manager.

### 5. Log Auth Events

Log every authentication success and failure with the client ID (never the token itself). This audit trail is essential for security incident investigation.

### 6. Consider mTLS for Internal Agents

For agents that only communicate within your infrastructure, mutual TLS (mTLS) provides stronger guarantees than OAuth2 alone. The two can be combined: mTLS for transport security, OAuth2 for authorization.

### 7. Protect the Agent Card

While Agent Cards are typically public, consider rate-limiting the `/.well-known/agent-card.json` endpoint and monitoring access patterns. An attacker who discovers your agent's capabilities can craft more targeted attacks.

## Beyond OAuth2

OAuth2 handles authentication and authorization, but comprehensive agent security also includes:

- **Message signing** for integrity verification (see the Signing and Verifying sample)
- **Rate limiting** to prevent abuse
- **Input validation** to prevent prompt injection
- **Audit logging** for compliance
- **Network policies** to restrict agent-to-agent communication paths

Explore the full [Security & Auth stack](/stacks/security-auth) on StackA2A to find agents and tools for securing your A2A deployment.
