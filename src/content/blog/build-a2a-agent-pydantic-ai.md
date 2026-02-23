---
title: "Build an A2A Agent with PydanticAI and FastA2A in 5 Minutes"
description: "Step-by-step guide to building a production-ready A2A agent using PydanticAI and FastA2A — the fastest way to go from zero to a working A2A server in Python."
date: "2026-02-23"
readingTime: 6
tags: ["a2a", "pydantic-ai", "fasta2a", "python", "tutorial"]
relatedStacks: ["pydantic-ai-stack"]
relatedAgents: ["pydantic-fasta2a", "python-a2a"]
---

PydanticAI is a Python agent framework from the Pydantic team. It brings the same developer experience as FastAPI -- type hints, dependency injection, structured outputs -- to building LLM-powered agents. FastA2A is its built-in module that turns any PydanticAI agent into a full A2A-compliant server with one method call.

No boilerplate JSON-RPC handlers. No manual Agent Card construction. One line: `agent.to_a2a()`.

## Install

You need Python 3.10+ and an LLM API key (OpenAI, Google, Anthropic, or any supported provider).

```bash
mkdir my-a2a-agent && cd my-a2a-agent
python -m venv .venv
source .venv/bin/activate
pip install "pydantic-ai[a2a]" uvicorn
```

The `[a2a]` extra pulls in the `fasta2a` module and its dependencies.

```bash
export OPENAI_API_KEY="sk-..."
```

## Create the Agent

Build a PydanticAI agent in a file called `agent.py`:

```python
# agent.py
from pydantic_ai import Agent

agent = Agent(
    "openai:gpt-4o",
    instructions=(
        "You are a code review assistant. When given code, analyze it for "
        "bugs, security issues, and style problems. Return a structured "
        "review with severity levels (critical, warning, info) for each finding."
    ),
)
```

That is a working agent. You can test it locally before exposing it over A2A:

```python
result = agent.run_sync("Review this Python: eval(input())")
print(result.output)
```

## Expose as A2A Server

Add one line to turn it into an A2A server:

```python
# agent.py
from pydantic_ai import Agent

agent = Agent(
    "openai:gpt-4o",
    instructions=(
        "You are a code review assistant. When given code, analyze it for "
        "bugs, security issues, and style problems. Return a structured "
        "review with severity levels (critical, warning, info) for each finding."
    ),
)

app = agent.to_a2a(
    name="Code Review Agent",
    description="Analyzes code for bugs, security vulnerabilities, and style issues",
    version="1.0.0",
)
```

`to_a2a()` returns an ASGI application. It automatically generates an Agent Card, creates JSON-RPC endpoints for `message/send` and `message/stream`, and serves the card at `/.well-known/agent-card.json`.

## Run the Server

```bash
uvicorn agent:app --host 0.0.0.0 --port 8000
```

Your A2A agent is live. Verify by fetching the Agent Card:

```bash
curl -s http://localhost:8000/.well-known/agent-card.json | python -m json.tool
```

```json
{
    "name": "Code Review Agent",
    "description": "Analyzes code for bugs, security vulnerabilities, and style issues",
    "version": "1.0.0",
    "url": "http://localhost:8000",
    "capabilities": {
        "streaming": true,
        "pushNotifications": false
    },
    "defaultInputModes": ["text"],
    "defaultOutputModes": ["text"],
    "skills": []
}
```

## Test with curl

Send a task via the A2A JSON-RPC protocol:

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
            "text": "Review this code:\n\ndef login(user, pwd):\n    query = f\"SELECT * FROM users WHERE name={user} AND pass={pwd}\"\n    db.execute(query)\n    return True"
          }
        ]
      }
    }
  }'
```

The response follows the A2A task lifecycle -- the agent returns a completed task with its review as an artifact.

## Add Skills to the Agent Card

Skills make your agent discoverable. Other agents can match tasks to your agent based on skill descriptions and tags:

```python
from fasta2a import Skill

app = agent.to_a2a(
    name="Code Review Agent",
    description="Analyzes code for bugs, security vulnerabilities, and style issues",
    version="1.0.0",
    skills=[
        Skill(
            id="security-review",
            name="Security Review",
            description="Identifies SQL injection, XSS, CSRF, and other security vulnerabilities in code",
            tags=["security", "vulnerabilities", "owasp"],
        ),
        Skill(
            id="style-review",
            name="Style Review",
            description="Checks code style, naming conventions, and adherence to PEP 8 or language-specific standards",
            tags=["style", "linting", "best-practices"],
        ),
    ],
)
```

## Add Tools

PydanticAI agents get powerful when you give them tools. Tools are plain Python functions decorated with `@agent.tool` or `@agent.tool_plain`:

```python
from pydantic_ai import Agent

agent = Agent(
    "openai:gpt-4o",
    instructions=(
        "You are a code review assistant. Use the available tools to "
        "look up documentation and check for known vulnerabilities."
    ),
)

@agent.tool_plain
def check_cve_database(package_name: str, version: str) -> str:
    """Check if a package version has known CVEs.

    Args:
        package_name: The name of the package (e.g., 'django', 'flask').
        version: The version string (e.g., '3.2.1').

    Returns:
        A summary of known vulnerabilities, or 'No known CVEs' if clean.
    """
    # In production, call the NVD API or OSV.dev
    return f"No known CVEs for {package_name}@{version}"

@agent.tool_plain
def get_language_style_guide(language: str) -> str:
    """Get the official style guide recommendations for a programming language.

    Args:
        language: The programming language (e.g., 'python', 'javascript').

    Returns:
        Key style guide rules and conventions.
    """
    guides = {
        "python": "Follow PEP 8: 4-space indent, snake_case, max 79 chars per line",
        "javascript": "Follow Airbnb style: const over let, arrow functions, semicolons",
    }
    return guides.get(language.lower(), f"No style guide found for {language}")

app = agent.to_a2a(
    name="Code Review Agent",
    description="Code review agent with CVE checking and style guide lookup",
    version="1.1.0",
)
```

The LLM decides when to call these tools based on the function name, docstring, and parameter types. PydanticAI extracts the schema automatically from the type hints.

## Add Dependencies

PydanticAI's dependency injection system lets you pass runtime context (database connections, API clients, user sessions) into tool functions without globals:

```python
from dataclasses import dataclass
from pydantic_ai import Agent, RunContext
import httpx

@dataclass
class ReviewDeps:
    http_client: httpx.AsyncClient
    repo_url: str

agent = Agent(
    "openai:gpt-4o",
    deps_type=ReviewDeps,
    instructions="You are a code review assistant.",
)

@agent.tool
async def fetch_file_from_repo(ctx: RunContext[ReviewDeps], file_path: str) -> str:
    """Fetch a file from the repository for additional context.

    Args:
        file_path: Path to the file in the repository.

    Returns:
        The file contents.
    """
    url = f"{ctx.deps.repo_url}/raw/main/{file_path}"
    resp = await ctx.deps.http_client.get(url)
    resp.raise_for_status()
    return resp.text

app = agent.to_a2a(
    name="Code Review Agent",
    description="Code review agent with repo file access",
    version="1.2.0",
)
```

Tools that accept `RunContext[ReviewDeps]` as their first argument automatically receive the dependencies at runtime.

## Structured Output

For agents that need to return structured data, set `output_type` to a Pydantic model:

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class ReviewResult(BaseModel):
    findings: list[dict]
    overall_risk: str  # "low", "medium", "high", "critical"
    summary: str

agent = Agent(
    "openai:gpt-4o",
    output_type=ReviewResult,
    instructions="Review code and return structured findings.",
)

app = agent.to_a2a(
    name="Structured Code Review Agent",
    description="Returns structured JSON code review results",
    version="2.0.0",
)
```

The A2A response artifacts will contain the JSON-serialized `ReviewResult`.

## Deploy to Production

For production, use gunicorn with uvicorn workers:

```bash
pip install gunicorn
gunicorn agent:app -w 4 -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

Set the `url` parameter in `to_a2a()` to your production domain so the Agent Card has the correct URL:

```python
app = agent.to_a2a(
    name="Code Review Agent",
    description="Code review agent",
    version="1.0.0",
    url="https://code-review.your-domain.com",
)
```

With Docker:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent.py .
CMD ["gunicorn", "agent:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

PydanticAI plus FastA2A gets you from zero to a production A2A agent faster than any other Python stack. The `to_a2a()` method handles the protocol plumbing so you can focus on what your agent actually does.
