---
title: "A2A vs MCP: Different Jobs, Stop Conflating Them"
description: "MCP is for tool access. A2A is for agent delegation. Here's exactly when you need each, why most production systems use both, and how to bridge them."
date: "2026-01-22"
readingTime: 5
tags: ["a2a", "mcp", "comparison", "architecture"]
relatedStacks: ["google-adk-stack", "multi-agent"]
---

MCP and A2A keep getting compared like they're competing standards. They aren't. They operate at different layers entirely, and confusing them leads to bad architecture decisions.

**MCP** (Model Context Protocol, by Anthropic) is tool access. It gives an LLM the ability to call functions — read a file, query a database, hit an API. The LLM decides which tool to call and with what arguments. The server executes it and returns a result. That's it.

**A2A** (Agent-to-Agent, by Google) is delegation. One agent sends work to another agent. The receiving agent is autonomous — it decides *how* to complete the task, potentially using its own tools, sub-agents, and multi-step reasoning. The caller doesn't micromanage.

The difference matters. With MCP, the LLM is in control. With A2A, the agent you're delegating to is in control.

## MCP: tool access

When you configure an MCP server in Claude Code or Cursor, you're giving the LLM a set of callable functions. The LLM picks the right function, constructs the arguments, and gets back a result.

MCP tools are simple. They have a name, a JSON schema for inputs, and they return a response. No state between calls. No multi-turn conversation. No autonomy on the server side — the server just executes what it's told.

This is the right model when you want an LLM to interact with external systems: filesystems, databases, APIs, browsers. The LLM orchestrates everything.

## A2A: agent delegation

A2A flips the control model. When an orchestrator agent sends a task to another agent via A2A, it's saying "handle this" — not "call this function with these args." The receiving agent might:

- Break the task into subtasks
- Call its own tools
- Delegate to other agents
- Ask the caller for clarification (`input-required` state)
- Stream partial results back as it works

A2A agents advertise their capabilities through [Agent Cards](/blog/a2a-agent-card-explained) — JSON metadata at `/.well-known/agent-card.json`. Discovery is built into the protocol. So is streaming (SSE), multi-turn state, and push notifications for long-running work.

## Side by side

| | MCP | A2A |
|---|---|---|
| **What it does** | Tool access for LLMs | Agent-to-agent delegation |
| **Control model** | LLM controls execution | Receiving agent controls execution |
| **Discovery** | Manual config | Agent Cards (automatic) |
| **Transport** | stdio + HTTP | HTTP + SSE |
| **State** | Stateless | Multi-turn conversations |
| **Auth** | Implementation-dependent | Defined in spec (OpenAPI-style) |
| **Streaming** | Per-tool basis | Native SSE |

## When to use which

**Use MCP when the LLM should stay in control.** Adding database queries to Claude Code? MCP. Building a tool that formats markdown? MCP. Any case where the "server" is a dumb function that takes input and returns output — MCP.

**Use A2A when you're delegating to something autonomous.** You have a research agent that takes a topic and runs a multi-step investigation? A2A. A code review agent that pulls context, analyzes patterns, and generates a report? A2A. Anything where the receiving side needs to think, plan, and act on its own — A2A.

A useful heuristic: if you'd describe the integration as "calling a function," use MCP. If you'd describe it as "asking someone to handle something," use A2A.

## Bridging them

Most production systems end up needing both. The cleanest pattern is an MCP server that acts as a gateway to A2A agents:

```python
# MCP server that bridges to an A2A research agent
from mcp.server import Server
from a2a.client import A2AClient

server = Server("research-bridge")
a2a_client = A2AClient(url="https://research-agent.example.com")

@server.tool("deep_research")
async def deep_research(topic: str, depth: str = "standard") -> str:
    """Delegates research to a specialized A2A agent."""
    response = await a2a_client.send_message(
        message={
            "role": "user",
            "parts": [{"kind": "text", "text": f"Research: {topic} (depth: {depth})"}]
        }
    )
    # Extract text from the agent's response artifacts
    return "\n".join(
        part["text"]
        for artifact in response.artifacts
        for part in artifact.parts
        if part["kind"] == "text"
    )
```

From the LLM's perspective, it's calling an MCP tool. Behind the scenes, that tool delegates to an autonomous A2A agent that does the heavy lifting. The LLM gets back results without needing to know about the A2A layer.

This pattern shows up in several official samples:

- `a2a-sample-a2a-mcp` — reference implementation combining both protocols
- `a2a-sample-weather-mcp` — weather agent accessible via both MCP and A2A

You can also go the other direction: an A2A agent that uses MCP tools internally. The agent receives tasks via A2A, reasons about them, and calls MCP tools to interact with external systems as part of its execution.

MCP and A2A aren't competing. MCP is the tool layer — how LLMs interact with the world. A2A is the service layer — how agents interact with each other. Start with whichever solves your immediate problem. You'll probably add the other one soon enough.

See also: [agent directory](/agents) for A2A agents, [StackMCP](https://stackmcp.dev) for MCP servers.
