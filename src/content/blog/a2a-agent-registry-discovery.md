---
title: "A2A Agent Registry: How to Discover and Register Agents"
description: "Complete guide to A2A agent discovery mechanisms — from well-known URIs and DNS-based discovery to agent registries and the agent:// URI scheme."
date: "2026-02-23"
readingTime: 8
tags: ["a2a", "registry", "discovery", "agent-card", "architecture"]
relatedStacks: ["security-auth", "security-tools"]
relatedAgents: ["a2a-directory", "a2a-inspector", "a2a-playground"]
---

Before an agent can call another agent over A2A, it needs to find it. The A2A protocol defines a discovery layer built on **Agent Cards** -- JSON documents that describe what an agent does, how to authenticate, and where to reach it. This guide covers every discovery mechanism available today: well-known URIs, curated registries, direct configuration, and the emerging `agent://` URI scheme.

## The Agent Card

Every A2A discovery mechanism revolves around the Agent Card. It is a JSON document that contains identity metadata, the service endpoint, supported capabilities, authentication requirements, and a list of skills.

```json
{
  "name": "Invoice Processor",
  "description": "Extracts line items, totals, and metadata from invoice documents.",
  "version": "2.1.0",
  "url": "https://invoices.example.com/",
  "provider": {
    "organization": "Acme Corp",
    "url": "https://acme.example.com"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "authentication": {
    "schemes": ["Bearer"],
    "credentials": "https://auth.acme.example.com/.well-known/openid-configuration"
  },
  "defaultInputModes": ["text/plain", "application/pdf"],
  "defaultOutputModes": ["application/json"],
  "skills": [
    {
      "id": "extract-line-items",
      "name": "Line Item Extraction",
      "description": "Extracts individual line items with descriptions, quantities, and prices from invoices.",
      "tags": ["invoice", "extraction", "finance"],
      "examples": [
        "Extract all line items from this invoice PDF",
        "Parse the attached receipt and return structured data"
      ],
      "inputModes": ["application/pdf", "image/png"],
      "outputModes": ["application/json"]
    },
    {
      "id": "validate-totals",
      "name": "Total Validation",
      "description": "Validates that line item totals match the invoice total and flags discrepancies.",
      "tags": ["invoice", "validation", "finance"],
      "examples": ["Check if the line items add up to the total on this invoice"]
    }
  ]
}
```

The `skills` array is what makes programmatic discovery possible. A client agent can match its current task against skill descriptions, tags, and examples to find the right agent for the job.

## Discovery mechanism 1: Well-Known URI

The primary discovery method defined by the A2A spec follows [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615). An A2A server hosts its Agent Card at a standardized path:

```
https://{domain}/.well-known/agent-card.json
```

A client that knows (or can guess) the domain performs a GET request:

```bash
curl -s https://invoices.example.com/.well-known/agent-card.json | jq .
```

This works well for public agents and domain-controlled discovery. If you run an agent at `invoices.example.com`, any other agent can discover it by convention.

### Serving the card in Python

If you are building your own A2A server without a framework, serving the card is straightforward:

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import json

app = FastAPI()

with open("agent-card.json") as f:
    agent_card = json.load(f)

@app.get("/.well-known/agent-card.json")
async def get_agent_card():
    return JSONResponse(content=agent_card)
```

Frameworks like Strands Agents and Google ADK handle this automatically when you create an A2A server.

## Discovery mechanism 2: Curated registries

For enterprises and marketplaces, well-known URIs are not enough. You cannot query a domain for "all agents that process invoices." A **curated registry** solves this by maintaining a searchable collection of Agent Cards.

The A2A specification acknowledges registries as a discovery strategy but does not prescribe a standard registry API. This means you build your own or use a third-party service.

### Building a minimal registry

A registry is an API that accepts Agent Card registrations and supports queries by skill, tag, or capability. Here is a minimal implementation:

```python
# registry.py
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import uuid

app = FastAPI(title="A2A Agent Registry")

registry: dict[str, dict] = {}

class AgentRegistration(BaseModel):
    agent_card: dict
    owner: str

@app.post("/agents")
async def register_agent(registration: AgentRegistration):
    agent_id = str(uuid.uuid4())
    card = registration.agent_card
    registry[agent_id] = {
        "id": agent_id,
        "card": card,
        "owner": registration.owner,
        "name": card.get("name"),
        "skills": [s.get("id") for s in card.get("skills", [])],
        "tags": _extract_tags(card),
    }
    return {"id": agent_id, "status": "registered"}

@app.get("/agents")
async def search_agents(
    skill: Optional[str] = Query(None, description="Filter by skill tag"),
    q: Optional[str] = Query(None, description="Search name and description"),
):
    results = list(registry.values())

    if skill:
        results = [
            a for a in results
            if skill in a["tags"]
        ]

    if q:
        q_lower = q.lower()
        results = [
            a for a in results
            if q_lower in a["card"].get("name", "").lower()
            or q_lower in a["card"].get("description", "").lower()
        ]

    return {"agents": [a["card"] for a in results]}

@app.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    if agent_id not in registry:
        raise HTTPException(status_code=404, detail="Agent not found")
    return registry[agent_id]["card"]

def _extract_tags(card: dict) -> list[str]:
    tags = set()
    for skill in card.get("skills", []):
        tags.update(skill.get("tags", []))
    return list(tags)
```

### Registering an agent programmatically

```python
import httpx

agent_card = {
    "name": "Invoice Processor",
    "description": "Extracts line items from invoice documents.",
    "url": "https://invoices.example.com/",
    "version": "2.1.0",
    "capabilities": {"streaming": True, "pushNotifications": False},
    "skills": [
        {
            "id": "extract-line-items",
            "name": "Line Item Extraction",
            "description": "Extracts line items with prices from invoices.",
            "tags": ["invoice", "extraction", "finance"],
        }
    ],
}

response = httpx.post(
    "https://registry.example.com/agents",
    json={"agent_card": agent_card, "owner": "acme-corp"},
)
print(response.json())
# {"id": "d4e5f6...", "status": "registered"}
```

### Querying for agents with specific skills

```python
# Find all agents that handle invoices
response = httpx.get(
    "https://registry.example.com/agents",
    params={"skill": "invoice"},
)
agents = response.json()["agents"]

for agent in agents:
    print(f"{agent['name']} - {agent['url']}")
    for skill in agent["skills"]:
        print(f"  Skill: {skill['name']}")
```

An orchestrator agent can use this pattern at runtime: query the registry for agents matching the current task, select the best match by skill description, then call it via A2A.

## Discovery mechanism 3: Direct configuration

For tightly coupled systems, hardcode agent endpoints in configuration:

```python
# config.py
AGENT_ENDPOINTS = {
    "calculator": "http://calculator-service:9000",
    "research": "http://research-service:9000",
    "invoice": "https://invoices.example.com",
}
```

Or use environment variables:

```bash
export A2A_CALCULATOR_URL="http://calculator-service:9000"
export A2A_RESEARCH_URL="http://research-service:9000"
```

This is the simplest approach and works well in Kubernetes deployments where service DNS is predictable. The downside is that Agent Card changes require client reconfiguration.

## The agent:// URI scheme

The A2A specification currently uses HTTPS URLs for agent endpoints. A complementary proposal introduces the `agent://` URI scheme for topology-independent agent naming. Instead of coupling an agent's identity to its network address, `agent://` separates naming from resolution:

```
agent://acme.example.com/invoice-processor
```

The URI identifies the agent. A resolution layer (analogous to DNS) maps it to the current HTTPS endpoint. This decoupling enables:

- **Portability**: Move an agent between hosts without updating every client.
- **Organizational scoping**: The domain in the URI represents the organization, not the server.
- **Capability-based routing**: Resolve the URI to different endpoints based on the requested skill.

The resolution flow works like this:

1. Client encounters `agent://acme.example.com/invoice-processor`.
2. An Agent Naming Service (ANS) resolves the URI to the current Agent Card URL.
3. Client fetches the Agent Card and communicates over standard HTTPS.

This is not yet part of the core A2A spec but is under active discussion. You can adopt it today as a convention in your internal systems by building a simple resolution service that maps `agent://` URIs to HTTPS endpoints.

## Extended Agent Cards and security

The A2A spec supports two levels of Agent Card disclosure:

- **Public Agent Card**: Served at the well-known URI without authentication. Contains basic metadata, the endpoint URL, and a summary of capabilities. Safe to expose publicly.
- **Authenticated Extended Agent Card**: Returned only after the client authenticates. Contains sensitive details like internal skill configurations, rate limits, or pricing information.

```json
{
  "name": "Invoice Processor",
  "url": "https://invoices.example.com/",
  "supportsAuthenticatedExtendedCard": true,
  "skills": [
    {
      "id": "extract-line-items",
      "name": "Line Item Extraction",
      "description": "Extracts line items from invoices."
    }
  ]
}
```

When `supportsAuthenticatedExtendedCard` is `true`, a client can request the full card by authenticating first. The extended card might include additional skills, internal configuration, or usage terms not visible to anonymous clients.

### Security best practices for discovery

**Sign your Agent Cards.** Use JWS (JSON Web Signature) to let clients verify the card has not been tampered with. Include the verification key in your DNS records or publish it at a well-known URI.

**Use mTLS or OAuth for registry access.** Public registries should at minimum require OAuth tokens. Enterprise registries should use mTLS so both client and server verify each other's identity.

**Validate Agent Cards on fetch.** Before calling an agent, validate the card against the A2A JSON schema. Check that the URL uses HTTPS, the authentication schemes are ones you support, and the skills match what you expect.

```python
from a2a.types import AgentCard
from pydantic import ValidationError

def validate_agent_card(card_data: dict) -> AgentCard | None:
    try:
        card = AgentCard(**card_data)
        if not card.url.startswith("https://"):
            raise ValueError("Agent URL must use HTTPS")
        return card
    except (ValidationError, ValueError) as e:
        print(f"Invalid agent card: {e}")
        return None
```

**Rotate credentials out of band.** The A2A spec recommends against embedding static secrets in Agent Cards. Use OAuth 2.0 client credentials flow or short-lived tokens exchanged through the authentication endpoint referenced in the card.

## Setting up discovery for a multi-agent system

Here is a practical pattern that combines registry-based discovery with well-known URIs. Each agent registers itself at startup and other agents query the registry at task time:

```python
# agent_startup.py
import httpx
import json

REGISTRY_URL = "https://registry.internal.example.com"

def register_self(card_path: str, owner: str):
    with open(card_path) as f:
        card = json.load(f)

    response = httpx.post(
        f"{REGISTRY_URL}/agents",
        json={"agent_card": card, "owner": owner},
    )
    response.raise_for_status()
    print(f"Registered as {response.json()['id']}")

def find_agent_for_task(task_description: str, required_tag: str) -> str | None:
    response = httpx.get(
        f"{REGISTRY_URL}/agents",
        params={"skill": required_tag, "q": task_description},
    )
    agents = response.json()["agents"]
    if agents:
        return agents[0]["url"]
    return None

# On startup
register_self("agent-card.json", owner="platform-team")

# At task time
endpoint = find_agent_for_task("extract invoice line items", "invoice")
if endpoint:
    # Use A2A client to communicate
    from strands.agent.a2a_agent import A2AAgent
    agent = A2AAgent(endpoint=endpoint)
    result = agent("Extract line items from the attached invoice")
```

This gives you centralized visibility into all running agents, capability-based routing without hardcoded URLs, and the ability to swap agent implementations without touching client code.

## What comes next

The A2A community is actively working on a standardized registry API (see [GitHub Discussion #741](https://github.com/a2aproject/A2A/discussions/741)). Once ratified, registries built by different vendors will be interoperable. Until then, the patterns in this guide give you a solid foundation for agent discovery in production systems.
