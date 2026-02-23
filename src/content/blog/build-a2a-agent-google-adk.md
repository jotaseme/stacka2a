---
title: "How to Build an A2A Agent with Google ADK"
description: "Step-by-step tutorial to build, expose, and test an A2A-compliant agent using Google's Agent Development Kit (ADK). From installation to deployment with working code examples."
date: "2026-02-22"
readingTime: 10
tags: ["a2a", "google-adk", "tutorial", "python"]
relatedStacks: ["google-adk-stack"]
---

Google's **Agent Development Kit (ADK)** is the fastest way to build an A2A-compliant agent. The ADK provides a `to_a2a()` function that takes your existing agent and exposes it as a fully functional A2A server — complete with auto-generated Agent Card, JSON-RPC endpoints, and streaming support.

This tutorial walks you through building a working A2A agent from scratch, testing it locally, and verifying it with curl.

## What You'll Build

A **research assistant agent** that can summarize topics, answer questions, and provide structured analysis. The agent will:

- Expose an Agent Card at `/.well-known/agent-card.json`
- Accept tasks via the A2A `message/send` and `message/stream` endpoints
- Support streaming responses via SSE
- Be testable with curl and the ADK web UI

## Prerequisites

- Python 3.12 or higher (3.13 recommended)
- A Google AI API key (for Gemini) or another supported LLM provider
- Basic familiarity with Python async programming
- pip or uv package manager

## Step 1: Install Google ADK

Create a new project directory and install the ADK with A2A support:

```bash
mkdir research-agent && cd research-agent
python -m venv .venv
source .venv/bin/activate
pip install "google-adk[a2a]"
```

The `[a2a]` extra installs the A2A Python SDK and the dependencies needed to expose your agent as an A2A server.

Set your API key as an environment variable:

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

## Step 2: Create the Agent

Create a file called `agent.py` with your agent definition. The ADK uses a declarative approach where you define your agent's model, instructions, and tools:

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

The `name` and `description` fields are important — the ADK uses them to auto-generate the Agent Card that other agents and clients will use to discover your agent.

## Step 3: Expose the Agent via A2A

Now add the A2A exposure. The `to_a2a()` function wraps your agent in an ASGI application that implements the full A2A protocol:

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

That single `to_a2a()` call does the heavy lifting. It:

- Generates an Agent Card from your agent's name, description, and capabilities
- Creates JSON-RPC handlers for `message/send` and `message/stream`
- Serves the Agent Card at `/.well-known/agent-card.json`
- Returns a uvicorn-compatible ASGI application

## Step 4: Run the Agent Server

Start the agent with uvicorn:

```bash
uvicorn agent:a2a_app --host localhost --port 8001
```

You should see output like:

```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://localhost:8001
```

## Step 5: Verify the Agent Card

In a separate terminal, fetch the auto-generated Agent Card:

```bash
curl -s http://localhost:8001/.well-known/agent-card.json | python -m json.tool
```

You should see a JSON response like:

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

The ADK auto-extracts the skills and metadata from your agent definition. You can customize this later.

## Step 6: Test with curl

Send a task to your agent using the A2A `message/send` JSON-RPC method:

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

The response will include a task object with the agent's output:

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

## Step 7: Test Streaming

To test streaming via SSE, use the `message/stream` method:

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

You will see SSE events streamed back as the agent generates its response, with each event containing a partial update to the task.

## Step 8: Customize the Agent Card

The auto-generated card works for development, but production agents should have a customized card with detailed skill descriptions and examples. Pass a custom `AgentCard` to `to_a2a()`:

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

## Step 9: Add Tools to the Agent

ADK agents become more powerful with tools. Here is an example adding a simple tool that the agent can call:

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

The ADK automatically converts Python functions with type hints and docstrings into tools that the LLM can call. The tool's parameters, types, and descriptions are all extracted from the function signature and docstring.

## Step 10: Create a Consumer Agent

To test agent-to-agent communication, create a second agent that consumes your research agent using `RemoteA2aAgent`:

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

Run this consumer agent with the ADK web UI:

```bash
adk web .
```

Then open `http://localhost:8000` to interact with the coordinator, which will delegate research tasks to your remote A2A agent running on port 8001.

## Deployment

For production deployment, you can run the agent behind any ASGI-compatible server. A typical setup with gunicorn:

```bash
pip install gunicorn uvicorn
gunicorn agent:a2a_app -w 4 -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8001
```

Make sure to update the `url` in your Agent Card to reflect your production domain.

## Next Steps

You now have a working A2A agent built with Google ADK. To explore curated agents and production-ready stacks built on ADK, check out [the Google ADK stack](/stacks/google-adk-stack) on StackA2A.
