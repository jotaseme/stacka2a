---
title: "How to Build an A2A Agent with Google ADK"
description: "Build, expose, and test an A2A-compliant agent using Google's Agent Development Kit. Working code from agent definition to consumer agent."
date: "2026-02-12"
readingTime: 8
tags: ["a2a", "google-adk", "tutorial", "python"]
relatedStacks: ["google-adk-stack"]
---

Google's **Agent Development Kit (ADK)** ships a `to_a2a()` function that wraps any ADK agent into a full A2A server — Agent Card, JSON-RPC endpoints, SSE streaming. One function call, zero boilerplate.

We are building a research assistant agent, exposing it over A2A, and wiring up a second agent that consumes it.

## Install Google ADK

You need Python 3.12+ and a Google AI API key for Gemini.

```bash
mkdir research-agent && cd research-agent
python -m venv .venv
source .venv/bin/activate
pip install "google-adk[a2a]"
```

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

## Define the agent

```python
# agent.py
from google.adk import Agent

research_agent = Agent(
    model="gemini-2.0-flash",
    name="research_assistant",
    description="A research assistant that summarizes topics, answers questions, and provides structured analysis on any subject.",
    instruction="""You are a research assistant. When given a topic or question:

1. Provide a clear, well-structured answer
2. Include relevant facts and context
3. Cite sources when possible
4. Use markdown formatting for readability

If the question is ambiguous, ask for clarification before proceeding.
Keep responses focused and concise — aim for 200-400 words unless more detail is explicitly requested.""",
)
```

The `name` and `description` feed directly into the auto-generated Agent Card.

## Expose via A2A

```python
# agent.py
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

research_agent = Agent(
    model="gemini-2.0-flash",
    name="research_assistant",
    description="A research assistant that summarizes topics, answers questions, and provides structured analysis on any subject.",
    instruction="""You are a research assistant. When given a topic or question:

1. Provide a clear, well-structured answer
2. Include relevant facts and context
3. Cite sources when possible
4. Use markdown formatting for readability

If the question is ambiguous, ask for clarification before proceeding.
Keep responses focused and concise — aim for 200-400 words unless more detail is explicitly requested.""",
)

# Expose the agent as an A2A server
a2a_app = to_a2a(research_agent, port=8001)
```

`to_a2a()` returns a uvicorn-compatible ASGI app. It generates the Agent Card from your agent metadata, creates JSON-RPC handlers for `message/send` and `message/stream`, and serves the card at `/.well-known/agent-card.json`.

## Run the server

```bash
uvicorn agent:a2a_app --host localhost --port 8001
```

## Verify the Agent Card

```bash
curl -s http://localhost:8001/.well-known/agent-card.json | python -m json.tool
```

```json
{
    "name": "research_assistant",
    "description": "A research assistant that summarizes topics, answers questions, and provides structured analysis on any subject.",
    "version": "1.0.0",
    "url": "http://localhost:8001/",
    "capabilities": {
        "streaming": true,
        "pushNotifications": false
    },
    "defaultInputModes": ["text/plain"],
    "defaultOutputModes": ["text/plain"],
    "skills": [
        {
            "id": "research_assistant",
            "name": "research_assistant",
            "description": "A research assistant that summarizes topics, answers questions, and provides structured analysis on any subject."
        }
    ]
}
```

## Test with curl

```bash
curl -X POST http://localhost:8001/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "type": "text",
            "text": "Summarize the key differences between REST and GraphQL APIs in 200 words."
          }
        ]
      }
    }
  }'
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": "test-1",
  "result": {
    "id": "task-abc123",
    "status": {
      "state": "completed"
    },
    "artifacts": [
      {
        "parts": [
          {
            "type": "text",
            "text": "REST and GraphQL differ in several key ways..."
          }
        ]
      }
    ]
  }
}
```

## Test streaming

```bash
curl -X POST http://localhost:8001/ \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-2",
    "method": "message/stream",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "type": "text",
            "text": "Explain how WebSockets work."
          }
        ]
      }
    }
  }'
```

SSE events stream back as the agent generates its response, each containing a partial task update.

## Customize the Agent Card

The auto-generated card works for development. For production, pass a custom `AgentCard` with explicit skills and examples:

```python
from a2a.types import AgentCard, AgentSkill, AgentCapabilities

custom_card = AgentCard(
    name="Research Assistant",
    description="AI research assistant for topic summarization, question answering, and structured analysis.",
    version="1.0.0",
    url="https://research-agent.example.com/",
    capabilities=AgentCapabilities(
        streaming=True,
        pushNotifications=False,
    ),
    defaultInputModes=["text/plain"],
    defaultOutputModes=["text/plain", "application/json"],
    skills=[
        AgentSkill(
            id="summarize",
            name="Topic Summarization",
            description="Summarizes any topic into a concise, well-structured overview with key facts and context.",
            tags=["research", "summarization", "writing"],
            examples=[
                "Summarize quantum computing in 200 words",
                "Give me an overview of the Rust programming language",
            ],
        ),
        AgentSkill(
            id="analyze",
            name="Comparative Analysis",
            description="Compares two or more concepts, technologies, or approaches with pros, cons, and recommendations.",
            tags=["research", "analysis", "comparison"],
            examples=[
                "Compare PostgreSQL vs MySQL for a startup",
                "Analyze the tradeoffs between microservices and monoliths",
            ],
        ),
    ],
    supportsAuthenticatedExtendedCard=False,
)

a2a_app = to_a2a(research_agent, port=8001, agent_card=custom_card)
```

Custom skills with `examples` and `tags` make your agent discoverable by other agents that match tasks to skills programmatically.

## Add tools

ADK converts Python functions with type hints and docstrings into LLM-callable tools automatically:

```python
from google.adk import Agent

def search_documentation(query: str, language: str = "python") -> str:
    """Search programming documentation for a given query.

    Args:
        query: The search query.
        language: The programming language to search docs for.

    Returns:
        Relevant documentation excerpts.
    """
    # In production, this would call an actual search API
    return f"Documentation results for '{query}' in {language}..."

research_agent = Agent(
    model="gemini-2.0-flash",
    name="research_assistant",
    description="A research assistant with documentation search capabilities.",
    instruction="You are a research assistant. Use the search_documentation tool when users ask about programming topics.",
    tools=[search_documentation],
)
```

Parameters, types, and descriptions are extracted from the function signature and docstring. No schema definition needed.

## Create a consumer agent

This is where A2A pays off. A second agent can consume your research agent using `RemoteA2aAgent` — no HTTP client code, no response parsing:

```python
# consumer.py
from google.adk import Agent
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent

remote_research = RemoteA2aAgent(
    name="remote_research",
    description="Remote research assistant available via A2A",
    agent_card_url="http://localhost:8001/.well-known/agent-card.json",
)

coordinator = Agent(
    model="gemini-2.0-flash",
    name="coordinator",
    description="Coordinates tasks and delegates research to the remote research agent.",
    instruction="You are a coordinator. When users ask research questions, delegate to the remote_research agent.",
    sub_agents=[remote_research],
)
```

Run it with the ADK web UI:

```bash
adk web .
```

Open `http://localhost:8000`. The coordinator delegates research to your A2A agent on port 8001 transparently.

## Deployment

Run behind any ASGI server. With gunicorn:

```bash
pip install gunicorn uvicorn
gunicorn agent:a2a_app -w 4 -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8001
```

Update the `url` in your Agent Card to the production domain.
