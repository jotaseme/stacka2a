---
title: "How to Build an A2A Agent with CrewAI"
description: "Build an A2A agent with CrewAI that works as both server and client. Expose a crew via A2A, connect to remote agents, handle auth, and run bidirectional agents."
date: "2026-02-16"
readingTime: 9
tags: ["a2a", "crewai", "tutorial", "python"]
relatedStacks: ["crewai-stack"]
---

**CrewAI does both sides of A2A natively.** `A2AServerConfig` exposes any agent as an A2A server. `A2AClientConfig` connects it to remote A2A agents as a client. Same agent, both directions, no adapter code. Most frameworks give you one or the other — CrewAI gives you both in the same `a2a` parameter.

We are building a content creation agent that accepts tasks over A2A and delegates research to a remote specialist.

## Install CrewAI

You need Python 3.10+ and an OpenAI API key (or any CrewAI-supported provider).

```bash
mkdir content-agent && cd content-agent
python -m venv .venv
source .venv/bin/activate
pip install 'crewai[a2a]'
```

```bash
export OPENAI_API_KEY="your-api-key-here"
```

## Define the agent as an A2A server

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

`A2AServerConfig` tells CrewAI to serve an Agent Card at `/.well-known/agent-card.json` and accept tasks via JSON-RPC when the crew starts.

## Define tasks and crew

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

## Run the A2A server

```python
# server.py
from agent import content_crew

if __name__ == "__main__":
    content_crew.kickoff()
```

```bash
python server.py
```

Agent Card at `http://localhost:8000/.well-known/agent-card.json`. A2A endpoint at `http://localhost:8000/`.

## Test the Agent Card

```bash
curl -s http://localhost:8000/.well-known/agent-card.json | python -m json.tool
```

## Test with curl

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

## Build a client agent

Point `A2AClientConfig` at a remote agent's card URL. CrewAI fetches the card, reads the skills, and the LLM routes tasks automatically:

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

The coordinator's LLM sees the remote writer's capabilities from its Agent Card and delegates writing tasks over A2A.

## Connect multiple remote agents

Pass a list. The LLM picks the right agent based on skill matching:

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

No manual routing logic. Each agent's skills are fetched from its card, and the LLM reads those descriptions to decide where to send each task.

## Bidirectional agent

This is where CrewAI's A2A model really shines. A single agent can be both server and client — accepting tasks from upstream while delegating subtasks downstream:

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

This is the building block for real multi-agent topologies. An orchestrator sends work to the editor over A2A, the editor sends fact-checking tasks to a research agent over A2A, and results flow back up. Each agent is independently deployable and replaceable.

## Authentication

Three auth methods out of the box.

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

## Error handling

Two modes for remote agent failures:

```python
# Fail-fast (default) — raises immediately if remote is unreachable
a2a=A2AClientConfig(
    endpoint="https://agent.example.com/.well-known/agent-card.json",
    fail_fast=True,
)

# Graceful degradation — reports failure to the LLM, which can adapt
a2a=A2AClientConfig(
    endpoint="https://agent.example.com/.well-known/agent-card.json",
    fail_fast=False,
)
```

Use `fail_fast=False` in production when you have multiple remote agents and want the system to keep functioning if one goes down.

## Deployment

```bash
pip install gunicorn
gunicorn server:app --bind 0.0.0.0:8000 --workers 4
```

Update the `url` in `A2AServerConfig` to your production domain. Set API keys via environment variables.
