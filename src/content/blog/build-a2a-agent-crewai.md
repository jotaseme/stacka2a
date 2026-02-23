---
title: "How to Build an A2A Agent with CrewAI"
description: "Step-by-step tutorial to build an A2A-compliant agent with CrewAI. Set up a crew, expose it as an A2A server, connect remote agents as clients, and deploy."
date: "2026-02-22"
readingTime: 10
tags: ["a2a", "crewai", "tutorial", "python"]
relatedStacks: ["crewai-stack"]
---

**CrewAI** treats the A2A protocol as a first-class feature. With built-in `A2AServerConfig` and `A2AClientConfig`, you can expose any CrewAI agent as an A2A server or connect it to remote A2A agents as a client — or both at the same time. No adapter code, no boilerplate wrappers.

This tutorial builds a working CrewAI agent that acts as both an A2A server (accepting tasks from other agents) and an A2A client (delegating tasks to remote specialists).

## What You'll Build

A **content creation agent** that can write blog posts, social media copy, and email sequences. It will:

- Accept tasks from any A2A client via `A2AServerConfig`
- Delegate research tasks to a remote agent via `A2AClientConfig`
- Support multiple authentication methods
- Handle multi-turn conversations with remote agents

## Prerequisites

- Python 3.10 or higher
- An OpenAI API key (or any LLM provider supported by CrewAI)
- Basic familiarity with CrewAI concepts (Agents, Tasks, Crews)
- pip or uv package manager

## Step 1: Install CrewAI with A2A Support

Create a project and install CrewAI with the A2A extra:

```bash
mkdir content-agent && cd content-agent
python -m venv .venv
source .venv/bin/activate
pip install 'crewai[a2a]'
```

The `[a2a]` extra pulls in the A2A SDK and all dependencies needed for server and client functionality.

Set your API key:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

## Step 2: Define the Agent

Create a file called `agent.py` with a CrewAI agent configured as an A2A server:

```python
# agent.py
from crewai import Agent, Task, Crew
from crewai.a2a import A2AServerConfig

# Define the content writer agent
writer = Agent(
    role="Content Writer",
    goal="Create high-quality, engaging content for technical audiences",
    backstory=(
        "You are an experienced technical content writer who specializes in "
        "developer-focused content. You write clearly, avoid jargon when possible, "
        "and always provide actionable takeaways. You adapt your tone and format "
        "to match the content type — blog posts are conversational, documentation "
        "is precise, social media is punchy."
    ),
    llm="gpt-4o",
    verbose=True,
    # Expose this agent as an A2A server
    a2a=A2AServerConfig(
        url="http://localhost:8000"
    ),
)
```

The `A2AServerConfig` tells CrewAI to expose this agent as an A2A-compliant server. When the crew starts, it will serve an Agent Card at `/.well-known/agent-card.json` and accept tasks via JSON-RPC.

## Step 3: Define Tasks and Crew

Wrap the agent in a task and crew:

```python
# agent.py (continued)

# Define a flexible task that accepts dynamic input
content_task = Task(
    description=(
        "Based on the user's request, create the appropriate content. "
        "Determine the content type (blog post, social media copy, email, "
        "documentation) from context and produce a polished draft. "
        "Include a title, the main content, and any relevant metadata."
    ),
    expected_output=(
        "A complete content draft in markdown format with a clear title, "
        "well-structured body, and a brief summary of the content strategy used."
    ),
    agent=writer,
)

# Create the crew
content_crew = Crew(
    agents=[writer],
    tasks=[content_task],
    verbose=True,
)
```

## Step 4: Run the A2A Server

Start the crew with A2A server mode enabled:

```python
# server.py
from agent import content_crew

if __name__ == "__main__":
    content_crew.kickoff()
```

```bash
python server.py
```

The server will start and expose:
- Agent Card at `http://localhost:8000/.well-known/agent-card.json`
- A2A endpoint at `http://localhost:8000/` for JSON-RPC requests

## Step 5: Test the Agent Card

Verify the Agent Card is being served:

```bash
curl -s http://localhost:8000/.well-known/agent-card.json | python -m json.tool
```

The response will include the agent's role, capabilities, and skills derived from your crew definition.

## Step 6: Test with curl

Send a content creation request via A2A:

```bash
curl -X POST http://localhost:8000/ \
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
            "text": "Write a short LinkedIn post announcing our new open-source CLI tool for database migrations. Keep it under 200 words. The tool is called Drift and it supports PostgreSQL and MySQL."
          }
        ]
      }
    }
  }'
```

## Step 7: Build a Client Agent

Now create a second agent that delegates tasks to your content server. This is where CrewAI's A2A client support shines — you just point `A2AClientConfig` at the remote agent's card URL:

```python
# client.py
from crewai import Agent, Task, Crew
from crewai.a2a import A2AClientConfig

# This agent delegates content tasks to the remote content writer
coordinator = Agent(
    role="Marketing Coordinator",
    goal="Plan and coordinate content production across channels",
    backstory=(
        "You are a marketing coordinator who plans content strategies and "
        "delegates the actual writing to specialist agents. You determine "
        "what content is needed, specify the requirements, and review the output."
    ),
    llm="gpt-4o",
    # Connect to the remote content writer via A2A
    a2a=A2AClientConfig(
        endpoint="http://localhost:8000/.well-known/agent-card.json",
        timeout=120,
        max_turns=10,
    ),
)

coordination_task = Task(
    description=(
        "Create a content plan for launching a new developer tool called Drift. "
        "Delegate the writing of a blog post introduction to the remote content agent. "
        "Review the output and provide feedback."
    ),
    expected_output="A content plan with the delegated blog post draft included.",
    agent=coordinator,
)

crew = Crew(
    agents=[coordinator],
    tasks=[coordination_task],
    verbose=True,
)

if __name__ == "__main__":
    result = crew.kickoff()
    print(result)
```

When this crew runs, the coordinator agent's LLM will see the remote content writer's capabilities (from its Agent Card) and automatically delegate writing tasks to it via A2A.

## Step 8: Connect Multiple Remote Agents

CrewAI supports connecting a single agent to multiple A2A endpoints. The LLM chooses which remote agent to delegate to based on skill matching:

```python
coordinator = Agent(
    role="Marketing Coordinator",
    goal="Coordinate content, research, and design tasks",
    backstory="Expert at delegating to the right specialist",
    llm="gpt-4o",
    a2a=[
        A2AClientConfig(
            endpoint="http://localhost:8000/.well-known/agent-card.json",
            timeout=120,
        ),
        A2AClientConfig(
            endpoint="http://localhost:8001/.well-known/agent-card.json",
            timeout=90,
        ),
        A2AClientConfig(
            endpoint="http://localhost:8002/.well-known/agent-card.json",
            timeout=60,
        ),
    ],
)
```

Each remote agent's skills are fetched from its Agent Card. The LLM reads these descriptions and routes tasks accordingly — no manual routing logic needed.

## Step 9: Add Authentication

For production deployments, you will need authentication between agents. CrewAI supports several auth methods out of the box.

**Bearer Token:**

```python
from crewai.a2a.auth import BearerTokenAuth

coordinator = Agent(
    role="Coordinator",
    goal="Coordinate with secured agents",
    backstory="Manages secure agent communications",
    llm="gpt-4o",
    a2a=A2AClientConfig(
        endpoint="https://content-agent.example.com/.well-known/agent-card.json",
        auth=BearerTokenAuth(token="your-bearer-token"),
        timeout=120,
    ),
)
```

**API Key:**

```python
from crewai.a2a.auth import APIKeyAuth

coordinator = Agent(
    role="Coordinator",
    goal="Coordinate with API-authenticated agents",
    backstory="Manages API-key communications",
    llm="gpt-4o",
    a2a=A2AClientConfig(
        endpoint="https://content-agent.example.com/.well-known/agent-card.json",
        auth=APIKeyAuth(
            api_key="your-api-key",
            location="header",
            name="X-API-Key",
        ),
        timeout=120,
    ),
)
```

**OAuth2 Client Credentials:**

```python
from crewai.a2a.auth import OAuth2ClientCredentials

coordinator = Agent(
    role="Coordinator",
    goal="Coordinate with OAuth-secured agents",
    backstory="Manages OAuth communications",
    llm="gpt-4o",
    a2a=A2AClientConfig(
        endpoint="https://content-agent.example.com/.well-known/agent-card.json",
        auth=OAuth2ClientCredentials(
            token_url="https://auth.example.com/oauth/token",
            client_id="your-client-id",
            client_secret="your-client-secret",
            scopes=["read", "write"],
        ),
        timeout=120,
    ),
)
```

## Step 10: Bidirectional Agent

An agent can be both a server and a client simultaneously. This is useful for agents that accept tasks from upstream orchestrators while delegating subtasks to downstream specialists:

```python
from crewai.a2a import A2AClientConfig, A2AServerConfig

editor = Agent(
    role="Content Editor",
    goal="Edit and refine content, delegating research when needed",
    backstory="Senior editor who reviews drafts and fact-checks claims",
    llm="gpt-4o",
    a2a=[
        # Accept tasks from upstream agents
        A2AServerConfig(url="https://editor.example.com"),
        # Delegate research to a remote agent
        A2AClientConfig(
            endpoint="https://research.example.com/.well-known/agent-card.json",
            timeout=120,
        ),
    ],
)
```

## Error Handling

CrewAI provides two modes for handling remote agent failures:

**Fail-fast (default):** Raises an error immediately if the remote agent is unreachable.

```python
a2a=A2AClientConfig(
    endpoint="https://agent.example.com/.well-known/agent-card.json",
    fail_fast=True,  # default
)
```

**Graceful degradation:** Reports the failure to the LLM, which can adapt by handling the task internally or trying another agent.

```python
a2a=A2AClientConfig(
    endpoint="https://agent.example.com/.well-known/agent-card.json",
    fail_fast=False,
)
```

Use `fail_fast=False` in production when you have multiple remote agents and want the system to keep functioning even if one goes down.

## Deployment

For production, run your CrewAI A2A server behind a reverse proxy with HTTPS:

```bash
# Use gunicorn for production
pip install gunicorn
gunicorn server:app --bind 0.0.0.0:8000 --workers 4
```

Make sure to:
1. Update the `url` in `A2AServerConfig` to your production domain
2. Configure authentication on the server side
3. Set environment variables for API keys and secrets (never hardcode credentials)

## Next Steps

You now have a CrewAI agent that can participate in the A2A ecosystem as both a server and a client. For curated agent configurations and production-ready CrewAI stacks, check out [the CrewAI stack](/stacks/crewai-stack) on StackA2A.
