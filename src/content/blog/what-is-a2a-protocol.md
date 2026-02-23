---
title: "The A2A Protocol: What It Is and How It Works"
description: "A2A is an open protocol that lets AI agents discover and talk to each other over HTTP. Here's how agent cards, task lifecycle, and protocol messages fit together — with code."
date: "2026-01-15"
readingTime: 6
tags: ["a2a", "protocol", "guide", "agent-to-agent"]
relatedStacks: ["google-adk-stack", "multi-agent"]
---

A2A (Agent-to-Agent) is an open protocol by Google that gives AI agents a standard way to discover each other, exchange messages, and delegate work — regardless of framework or language. It's HTTP-based, uses JSON-RPC, and works across any stack that can serve an HTTP endpoint.

## The interop problem

Every agent framework invented its own communication layer. LangGraph agents can't talk to CrewAI agents. A Python agent has no way to discover what a Java agent can do. You end up building custom glue for every integration, and none of it is reusable.

A2A fixes this with a single protocol that handles:

- **Discovery** — agents publish structured metadata (Agent Cards)
- **Task delegation** — send work to any agent that speaks A2A
- **Streaming** — real-time responses via SSE
- **Multi-turn conversations** — stateful back-and-forth within a task
- **Push notifications** — webhooks for long-running tasks

## How it works

### Agent cards

Every A2A agent publishes a JSON file at `/.well-known/agent-card.json`. It describes what the agent does, what it accepts, and how to authenticate:

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

Any client can fetch this to understand the agent's capabilities before sending it work. For a deep dive, see [Agent Cards Explained](/blog/a2a-agent-card-explained).

### Task lifecycle

Communication follows a straightforward flow:

1. Client sends a message to the agent's endpoint
2. Agent processes the task (potentially multiple steps, tool calls, sub-delegations)
3. Agent returns artifacts — text, files, structured data
4. Client can send follow-up messages within the same task for multi-turn interaction

Tasks have states: `submitted`, `working`, `input-required`, `completed`, `failed`, `canceled`. The `input-required` state is what makes multi-turn work — the agent can pause and ask for clarification.

### Protocol messages

A2A uses JSON-RPC 2.0 over HTTP. Four methods:

- **`tasks/send`** — send a message, get a response
- **`tasks/sendSubscribe`** — send a message, stream the response via SSE
- **`tasks/get`** — check the status of a running task
- **`tasks/cancel`** — cancel a running task

A basic `tasks/send` request looks like:

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "id": "req-1",
  "params": {
    "id": "task-abc",
    "message": {
      "role": "user",
      "parts": [{ "kind": "text", "text": "Analyze this dataset" }]
    }
  }
}
```

## A2A vs MCP (briefly)

| | A2A | MCP |
|---|---|---|
| **Purpose** | Agent-to-agent delegation | Tool access for LLMs |
| **Transport** | HTTP/SSE | stdio/HTTP |
| **Discovery** | Agent Cards | Client configuration |
| **State** | Multi-turn conversations | Stateless tool calls |

They're complementary, not competing. MCP gives an LLM access to tools. A2A lets agents delegate to other agents. There's a [full comparison post](/blog/a2a-vs-mcp-comparison) if you want the details.

## Getting started

Discover an agent:

```bash
curl https://agent.example.com/.well-known/agent-card.json
```

Send it a message:

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

Build your own with Google's ADK:

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

Browse the [agent directory](/agents) to find agents to connect to, or pick a [framework stack](/stacks) to start building.
