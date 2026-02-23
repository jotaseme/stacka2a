---
title: "Google ADK Tutorial: Build and Deploy A2A Agents"
description: "Comprehensive Google ADK tutorial for 2026. Installation, agent definition, tools, sub-agents, A2A exposure, custom Agent Cards, deployment, and consuming remote agents."
date: "2026-03-20"
readingTime: 12
tags: ["a2a", "google-adk", "tutorial", "python"]
relatedStacks: ["google-adk-stack"]
relatedAgents: []
---

Google's Agent Development Kit (ADK) is the fastest path from zero to a production A2A agent. One `to_a2a()` call wraps any ADK agent into a fully compliant A2A server with Agent Card, JSON-RPC endpoints, and SSE streaming.

This tutorial covers the full lifecycle: installation, agent definition, tools, sub-agents, A2A exposure, custom cards, testing, remote agent consumption, and deployment. If you have built an ADK agent before, skip to the [A2A exposure section](#expose-via-a2a). If you are starting fresh, read on.

## Prerequisites

- Python 3.12+
- A Google AI API key (Gemini) or Vertex AI credentials
- Basic familiarity with async Python

## Installation

```bash
mkdir my-agent && cd my-agent
python -m venv .venv
source .venv/bin/activate
pip install "google-adk[a2a]"
```

The `[a2a]` extra pulls in the A2A server dependencies: `a2a-sdk`, `uvicorn`, and the Agent Card generation utilities.

```bash
export GOOGLE_API_KEY="your-gemini-api-key"
```

## Your first agent

An ADK agent is a Python object with a model, name, description, and instruction. Create `agent.py`:

```python
# agent.py
from google.adk import Agent

support_agent = Agent(
    model="gemini-2.0-flash",
    name="support_agent",
    description="Technical support agent that troubleshoots software issues and provides solutions.",
    instruction="""You are a technical support agent. When a user describes a problem:

1. Identify the root cause
2. Provide a clear, step-by-step solution
3. Include relevant commands or code snippets
4. Suggest preventive measures

Be direct. Skip pleasantries. If you need more information, ask specific diagnostic questions.""",
)
```

Test it locally with the ADK web UI:

```bash
adk web .
```

Open `http://localhost:8000`, select `support_agent`, and send messages. The web UI gives you a chat interface with tool call visualization and session history.

## Adding tools

ADK converts Python functions with type hints into LLM-callable tools. The function signature and docstring become the tool schema.

```python
# agent.py
import subprocess
import httpx
from google.adk import Agent


def check_service_status(service_name: str) -> str:
    """Check if a service is running and return its status.

    Args:
        service_name: Name of the service to check (e.g., 'nginx', 'postgres', 'redis').

    Returns:
        Current status of the service including uptime and resource usage.
    """
    # In production, replace with actual monitoring API calls
    statuses = {
        "nginx": "Running | Uptime: 45d | CPU: 0.2% | Memory: 12MB",
        "postgres": "Running | Uptime: 45d | CPU: 1.8% | Memory: 256MB | Connections: 23/100",
        "redis": "Running | Uptime: 45d | CPU: 0.1% | Memory: 64MB | Keys: 15,234",
    }
    return statuses.get(
        service_name.lower(),
        f"Service '{service_name}' not found in monitoring system",
    )


def search_knowledge_base(query: str, category: str = "all") -> str:
    """Search the internal knowledge base for troubleshooting articles.

    Args:
        query: Search query describing the issue.
        category: Filter by category: 'networking', 'database', 'auth', 'deployment', or 'all'.

    Returns:
        Relevant knowledge base articles with solutions.
    """
    # Simulated KB search -- replace with actual search API
    articles = {
        "connection refused": "KB-1042: Connection refused errors usually indicate the service is not running or is listening on a different port. Check with `ss -tlnp | grep <port>`.",
        "high memory": "KB-1089: High memory usage in PostgreSQL often comes from unoptimized queries. Run `SELECT * FROM pg_stat_activity` to check active queries.",
        "ssl certificate": "KB-1156: SSL certificate errors? Check expiry with `openssl x509 -enddate -noout -in /path/to/cert.pem`. Renew with certbot if expired.",
    }
    for keyword, article in articles.items():
        if keyword in query.lower():
            return article
    return f"No articles found for '{query}'. Escalate to engineering team."


def run_diagnostic(command: str) -> str:
    """Run a safe diagnostic command and return the output.

    Args:
        command: The diagnostic command to run. Limited to safe read-only commands.

    Returns:
        Command output or error message.
    """
    safe_commands = ["ping", "curl", "dig", "nslookup", "traceroute", "df", "free"]
    cmd_parts = command.split()
    if not cmd_parts or cmd_parts[0] not in safe_commands:
        return f"Command '{cmd_parts[0]}' is not in the allowed list: {safe_commands}"

    try:
        result = subprocess.run(
            cmd_parts,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout or result.stderr
    except subprocess.TimeoutExpired:
        return "Command timed out after 10 seconds"


support_agent = Agent(
    model="gemini-2.0-flash",
    name="support_agent",
    description="Technical support agent with service monitoring, knowledge base search, and diagnostic tools.",
    instruction="""You are a technical support agent. When a user describes a problem:

1. Check service status if relevant
2. Search the knowledge base for known solutions
3. Run diagnostics if needed
4. Provide a clear solution with commands

Use tools proactively. Don't guess when you can check.""",
    tools=[check_service_status, search_knowledge_base, run_diagnostic],
)
```

ADK extracts the parameter names, types, descriptions, and return types from the function. No JSON schema needed.

## Sub-agents

ADK agents can delegate to other local agents. This is useful for separating concerns without the overhead of network calls.

```python
# agent.py
from google.adk import Agent

# Specialist agents
network_agent = Agent(
    model="gemini-2.0-flash",
    name="network_specialist",
    description="Diagnoses network connectivity issues, DNS problems, and firewall rules.",
    instruction="You specialize in network troubleshooting. Focus on connectivity, DNS, routing, and firewall issues.",
    tools=[run_diagnostic],
)

database_agent = Agent(
    model="gemini-2.0-flash",
    name="database_specialist",
    description="Diagnoses database performance, connection, and query issues.",
    instruction="You specialize in database troubleshooting. Focus on PostgreSQL, MySQL, and Redis issues.",
    tools=[check_service_status, search_knowledge_base],
)

# Coordinator that delegates to specialists
support_agent = Agent(
    model="gemini-2.0-flash",
    name="support_agent",
    description="Technical support coordinator that routes issues to the right specialist.",
    instruction="""You are the first point of contact for support. Analyze the user's issue and delegate:
- Network problems (connectivity, DNS, timeouts) -> network_specialist
- Database problems (queries, connections, performance) -> database_specialist
- For other issues, handle directly using available tools.""",
    tools=[check_service_status, search_knowledge_base],
    sub_agents=[network_agent, database_agent],
)
```

Sub-agents run in the same process. ADK handles the routing -- the coordinator agent decides when to delegate based on its instruction and the sub-agent descriptions.

## Expose via A2A

This is the key step. `to_a2a()` wraps your agent into a complete A2A server:

```python
# agent.py
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

# ... agent definition from above ...

a2a_app = to_a2a(support_agent, port=8001)
```

Run it:

```bash
uvicorn agent:a2a_app --host 0.0.0.0 --port 8001
```

What `to_a2a()` creates:
- Agent Card at `/.well-known/agent-card.json` (auto-generated from agent metadata)
- JSON-RPC handler for `message/send` (synchronous)
- JSON-RPC handler for `message/stream` (SSE streaming)
- Session management for multi-turn conversations

## Verify the Agent Card

```bash
curl -s http://localhost:8001/.well-known/agent-card.json | python -m json.tool
```

```json
{
    "name": "support_agent",
    "description": "Technical support coordinator that routes issues to the right specialist.",
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
            "id": "support_agent",
            "name": "support_agent",
            "description": "Technical support coordinator that routes issues to the right specialist."
        }
    ]
}
```

The auto-generated card is functional but minimal. For production, use a custom card.

## Custom Agent Card

Override the auto-generated card with explicit skills, examples, and tags:

```python
from a2a.types import AgentCard, AgentSkill, AgentCapabilities

custom_card = AgentCard(
    name="Technical Support Agent",
    description="AI-powered technical support with service monitoring, knowledge base search, and network/database diagnostics.",
    version="2.0.0",
    url="https://support-agent.example.com/",
    capabilities=AgentCapabilities(
        streaming=True,
        pushNotifications=False,
    ),
    defaultInputModes=["text/plain"],
    defaultOutputModes=["text/plain"],
    skills=[
        AgentSkill(
            id="troubleshoot",
            name="Issue Troubleshooting",
            description="Diagnoses technical issues by checking service status, searching knowledge base, and running diagnostics.",
            tags=["support", "troubleshooting", "diagnostics"],
            examples=[
                "Nginx is returning 502 errors",
                "PostgreSQL connections are being refused",
                "Redis latency has spiked to 500ms",
            ],
        ),
        AgentSkill(
            id="status-check",
            name="Service Status Check",
            description="Reports the current status of monitored services including uptime, CPU, and memory usage.",
            tags=["monitoring", "status", "health"],
            examples=[
                "What's the status of the postgres service?",
                "Check all services",
            ],
        ),
    ],
)

a2a_app = to_a2a(support_agent, port=8001, agent_card=custom_card)
```

Explicit skills with `examples` and `tags` make your agent discoverable by LLM-based orchestrators that match tasks to agent capabilities. See [Agent Cards explained](/blog/a2a-agent-card-explained) for the full specification.

## Testing with curl

### Synchronous request

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
            "text": "Nginx is returning 502 errors on our production server. How do I fix this?"
          }
        ]
      }
    }
  }'
```

### Streaming request

```bash
curl -N -X POST http://localhost:8001/ \
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
            "text": "Check the status of postgres and redis."
          }
        ]
      }
    }
  }'
```

The `-N` flag disables output buffering so you see SSE events as they arrive.

## Testing with adk web

The ADK web UI works with A2A agents too. Point it at a directory containing your agent:

```bash
adk web .
```

Open `http://localhost:8000` and select your agent. The web UI shows:
- Message history
- Tool calls and their results
- Sub-agent delegation
- Streaming output in real time

For testing multi-agent setups, run each agent on a different port and test them independently before wiring them together.

## Consuming remote agents with RemoteA2aAgent

The real power of A2A: one agent consuming another over the network. ADK's `RemoteA2aAgent` wraps any remote A2A agent as if it were a local sub-agent.

```python
# consumer.py
from google.adk import Agent
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent

# Connect to the support agent running on port 8001
remote_support = RemoteA2aAgent(
    name="remote_support",
    description="Remote technical support agent available via A2A",
    agent_card_url="http://localhost:8001/.well-known/agent-card.json",
)

# Connect to another A2A agent (e.g., a code review agent on port 8002)
remote_code_review = RemoteA2aAgent(
    name="remote_code_review",
    description="Remote code review agent available via A2A",
    agent_card_url="http://localhost:8002/.well-known/agent-card.json",
)

# Coordinator that uses both remote agents
engineering_lead = Agent(
    model="gemini-2.0-flash",
    name="engineering_lead",
    description="Engineering lead that coordinates support and code review.",
    instruction="""You are an engineering lead. Based on the request:
- Technical issues and outages -> delegate to remote_support
- Code review requests -> delegate to remote_code_review
- Planning and coordination -> handle directly""",
    sub_agents=[remote_support, remote_code_review],
)
```

`RemoteA2aAgent` handles:
- Fetching and caching the remote Agent Card
- Serializing messages into A2A JSON-RPC format
- Deserializing responses back into ADK message format
- Streaming support (if the remote agent supports it)

The coordinator agent does not know or care that its sub-agents are remote. It delegates based on descriptions, same as with local sub-agents.

## Deployment

### Docker

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent.py .

EXPOSE 8001
CMD ["uvicorn", "agent:a2a_app", "--host", "0.0.0.0", "--port", "8001"]
```

### Production with gunicorn

```bash
pip install gunicorn
gunicorn agent:a2a_app -w 4 -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8001 \
  --timeout 120 \
  --graceful-timeout 30
```

Four workers handle concurrent requests. Set `--timeout` high enough for LLM response times.

### Cloud Run

```bash
gcloud run deploy support-agent \
  --source . \
  --port 8001 \
  --memory 1Gi \
  --timeout 120 \
  --allow-unauthenticated
```

Update the `url` in your Agent Card to the Cloud Run URL. If you use a custom card, set the URL to the production domain. If you use the auto-generated card, pass `url` to `to_a2a()`:

```python
a2a_app = to_a2a(support_agent, port=8001, url="https://support-agent-xyz.run.app")
```

## What to build next

With your agent deployed and exposed over A2A, you can:

- Wire it into a [multi-agent system](/blog/multi-agent-system-a2a) using the coordinator or pipeline pattern
- Add [authentication](/blog/a2a-agent-authentication-guide) for production security
- Set up [testing and debugging](/blog/a2a-agent-testing-debugging) workflows
- Browse the [Google ADK stack](/stacks/google-adk-stack) on StackA2A for more examples
- Explore other agents on the [agents directory](/agents)
