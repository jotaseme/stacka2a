---
title: "What Is the A2A Protocol? A Developer's Guide"
description: "The Agent-to-Agent (A2A) protocol lets AI agents discover and communicate with each other over HTTP. Learn how it works, why it matters, and how to get started."
date: "2026-02-22"
readingTime: 8
tags: ["a2a", "protocol", "guide", "agent-to-agent"]
relatedStacks: ["google-adk-stack", "multi-agent"]
---

The **Agent-to-Agent (A2A) protocol** is an open standard created by Google that enables AI agents to discover, communicate, and collaborate with each other — regardless of which framework or language they're built with.

## Why A2A Exists

Before A2A, every AI agent system was a walled garden. Your LangGraph agent couldn't talk to a CrewAI agent. Your Python agent couldn't discover a Java agent's capabilities. Each framework had its own way of doing things.

A2A changes that. It provides a standard HTTP-based protocol that any agent can implement to:

- **Advertise capabilities** via Agent Cards
- **Receive tasks** from other agents or clients
- **Stream responses** in real-time
- **Handle multi-turn conversations**
- **Support push notifications** for long-running tasks

## How It Works

### Agent Cards

Every A2A agent publishes a JSON file at `/.well-known/agent-card.json` that describes:

```json
{
  "name": "My Agent",
  "description": "Helps with data analysis",
  "version": "1.0.0",
  "url": "https://my-agent.example.com",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "stateTransitionHistory": true
  },
  "skills": [
    {
      "id": "analyze-data",
      "name": "Analyze Data",
      "description": "Analyzes CSV and JSON datasets",
      "tags": ["data", "analytics"]
    }
  ]
}
```

This is the agent's "business card" — other agents can fetch it to understand what this agent can do.

### Task Lifecycle

1. **Client sends a message** to the agent's endpoint
2. **Agent processes the task** (may involve multiple steps)
3. **Agent returns artifacts** (text, files, structured data)
4. **Multi-turn**: Client can send follow-up messages in the same task

### Protocol Messages

A2A uses a simple JSON-RPC style over HTTP:

- `tasks/send` — Send a message and get a response
- `tasks/sendSubscribe` — Send a message and stream the response via SSE
- `tasks/get` — Check the status of a running task
- `tasks/cancel` — Cancel a running task

## A2A vs MCP

| Feature | A2A | MCP |
|---------|-----|-----|
| Purpose | Agent-to-agent communication | Tool access for LLMs |
| Transport | HTTP/SSE | stdio/HTTP |
| Discovery | Agent Cards | Client configuration |
| Use case | Remote service orchestration | Local tool integration |
| Statefulness | Multi-turn conversations | Stateless tool calls |

**They're complementary.** MCP gives an LLM access to tools (filesystem, databases, APIs). A2A lets agents delegate work to other agents. Many production systems use both.

## Getting Started

### 1. Discover an Agent

```bash
curl https://agent.example.com/.well-known/agent-card.json
```

### 2. Send a Message

```python
from a2a.client import A2AClient

client = A2AClient(url="https://agent.example.com")
card = await client.get_agent_card()
print(f"Agent: {card.name}")

response = await client.send_message(
    message={
        "role": "user",
        "parts": [{"kind": "text", "text": "Analyze this dataset"}]
    }
)
```

### 3. Build Your Own Agent

The fastest way is with Google's ADK:

```python
from google.adk import Agent

agent = Agent(
    name="my-agent",
    description="My first A2A agent",
)

@agent.skill("greet")
async def greet(message):
    return f"Hello! You said: {message.text}"

agent.run(port=8080)
```

## The Ecosystem Today

As of early 2026, the A2A ecosystem includes:

- **350+ agents** indexed on StackA2A
- **10+ frameworks** supporting A2A (Google ADK, LangGraph, CrewAI, Spring Boot, etc.)
- **5 official SDKs** (Python, TypeScript, Java, Go, C#)
- **22K+ GitHub stars** on the main spec repo
- **150+ organizations** contributing

The protocol is governed by the Linux Foundation, ensuring it stays open and vendor-neutral.

## What's Next

A2A is still evolving. Key areas of development include:

- **Enterprise auth** — OAuth2 and mTLS for production deployments
- **Agent registries** — Centralized discovery of agents
- **Billing and metering** — Standardized usage tracking
- **Multi-modal** — Support for image, audio, and video in agent communication

The best way to learn is to start building. Browse our [agent directory](/agents) to find agents to connect to, or check out a [framework stack](/stacks) to see how they're built.
