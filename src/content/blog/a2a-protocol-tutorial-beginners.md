---
title: "A2A Protocol Tutorial: Your First Agent in 15 Minutes"
description: "Build your first A2A agent from scratch. Install the SDK, create an agent, expose it over A2A, test with curl, and consume it from another agent — all working code."
date: "2026-02-24"
readingTime: 10
tags: ["a2a", "tutorial", "python", "beginners"]
relatedStacks: ["google-adk-stack"]
---

You want to build an agent that other agents can discover and talk to over HTTP. A2A (Agent-to-Agent) is the protocol that makes this work. This tutorial gets you from zero to a running A2A agent in 15 minutes, with a second agent consuming it by the end.

No theory dumps. We build, we test, we move on.

## What you need

- Python 3.12+
- A terminal
- 15 minutes

That's it. No cloud accounts, no API keys for the basic setup. We'll use a simple echo agent first, then add LLM capabilities.

## Step 1: Install the A2A Python SDK

```bash
mkdir my-first-agent && cd my-first-agent
python -m venv .venv
source .venv/bin/activate
pip install a2a-sdk fastapi uvicorn
```

The `a2a-sdk` package gives you both server and client components. FastAPI is the web framework. Uvicorn runs it.

## Step 2: Create the agent

Create a file called `agent.py`. We start with the simplest possible agent — one that reverses whatever text you send it.

```python
# agent.py
import asyncio
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.server.apps import A2AFastAPIApplication
from a2a.types import (
    AgentCard,
    AgentCapabilities,
    AgentSkill,
    Task,
    TaskStatus,
    TaskState,
    TaskStatusUpdateEvent,
)
from a2a.utils.message import new_agent_text_message


class ReverseAgent(AgentExecutor):
    """Reverses any text sent to it."""

    async def execute(self, context: RequestContext, event_queue: EventQueue):
        # Extract the user's text from the message
        if not context.message or not context.message.parts:
            return

        user_text = context.message.parts[0].root.text

        # Signal that we're working
        await event_queue.put(
            TaskStatusUpdateEvent(
                task_id=context.task_id,
                context_id=context.context_id,
                status=TaskStatus(state=TaskState.working),
                final=False,
            )
        )

        # "Process" the input
        reversed_text = user_text[::-1]

        # Send the completed result
        await event_queue.put(
            Task(
                id=context.task_id,
                context_id=context.context_id,
                status=TaskStatus(
                    state=TaskState.completed,
                    message=new_agent_text_message(
                        reversed_text,
                        context.context_id,
                        context.task_id,
                    ),
                ),
            )
        )

    async def cancel(self, context: RequestContext, event_queue: EventQueue):
        await event_queue.put(
            Task(
                id=context.task_id,
                context_id=context.context_id,
                status=TaskStatus(state=TaskState.canceled),
            )
        )
```

Every A2A agent needs three things:

1. **An `AgentExecutor`** — the class that handles incoming messages
2. **An `EventQueue`** — how you send status updates and results back
3. **Task lifecycle management** — reporting `working`, `completed`, `canceled` states

The `execute` method is your agent's brain. It receives a message, does something with it, and puts results on the event queue.

## Step 3: Define the Agent Card

The Agent Card is how other agents discover what yours can do. Add this below your agent class:

```python
# Still in agent.py

agent_card = AgentCard(
    name="Reverse Agent",
    description="Reverses any text you send it. A simple demo agent.",
    url="http://localhost:8000",
    version="1.0.0",
    capabilities=AgentCapabilities(streaming=True),
    skills=[
        AgentSkill(
            id="reverse-text",
            name="Reverse Text",
            description="Takes any text input and returns it reversed.",
            tags=["text", "utility", "demo"],
            examples=["Reverse this sentence", "Hello, world!"],
        )
    ],
    default_input_modes=["text/plain"],
    default_output_modes=["text/plain"],
)
```

Key fields:
- **`name`** and **`description`** — what your agent does, in plain language
- **`url`** — where clients send JSON-RPC requests
- **`capabilities`** — what protocol features you support (streaming, push notifications)
- **`skills`** — discrete capabilities with examples

For a deeper dive on Agent Cards, see the [Agent Card reference](/blog/a2a-agent-card-json-schema).

## Step 4: Wire it up and serve

```python
# Still in agent.py

agent_executor = ReverseAgent()
task_store = InMemoryTaskStore()
handler = DefaultRequestHandler(agent_executor, task_store)

app_builder = A2AFastAPIApplication(agent_card, handler)
app = app_builder.build()
```

That's the entire server. The `A2AFastAPIApplication` creates two endpoints:

- `GET /.well-known/agent-card.json` — serves the Agent Card
- `POST /` — handles JSON-RPC requests (`message/send`, `message/stream`)

## Step 5: Run it

```bash
uvicorn agent:app --host localhost --port 8000
```

Your agent is live.

## Step 6: Test the Agent Card

```bash
curl -s http://localhost:8000/.well-known/agent-card.json | python -m json.tool
```

```json
{
    "name": "Reverse Agent",
    "description": "Reverses any text you send it. A simple demo agent.",
    "url": "http://localhost:8000",
    "version": "1.0.0",
    "capabilities": {
        "streaming": true
    },
    "skills": [
        {
            "id": "reverse-text",
            "name": "Reverse Text",
            "description": "Takes any text input and returns it reversed.",
            "tags": ["text", "utility", "demo"],
            "examples": ["Reverse this sentence", "Hello, world!"]
        }
    ],
    "defaultInputModes": ["text/plain"],
    "defaultOutputModes": ["text/plain"]
}
```

Any A2A client can fetch this URL to learn what your agent does before sending it a task.

## Step 7: Send a message with curl

```bash
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req-1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "Hello, A2A!"
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
  "id": "req-1",
  "result": {
    "id": "task-abc123",
    "contextId": "ctx-def456",
    "status": {
      "state": "completed",
      "message": {
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "!A2A ,olleH"
          }
        ]
      }
    }
  }
}
```

Your agent received the text, reversed it, and returned the result as a completed task. That's the full A2A request/response cycle.

## Step 8: Test streaming

```bash
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req-2",
    "method": "message/stream",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "Stream this!"
          }
        ]
      }
    }
  }'
```

You'll see SSE events flowing back — first a `working` status update, then the completed task with the reversed text.

## Step 9: Consume from another agent

Now the payoff. Create `consumer.py` — a script that discovers your agent and sends it work:

```python
# consumer.py
import asyncio
from a2a.client import A2AClient

async def main():
    # Connect to the agent (auto-discovers the Agent Card)
    async with A2AClient(url="http://localhost:8000") as client:
        # Fetch and inspect the agent card
        card = await client.get_agent_card()
        print(f"Connected to: {card.name}")
        print(f"Skills: {[s.name for s in card.skills]}")

        # Send a message
        response = await client.send_message(
            message={
                "role": "user",
                "parts": [{"kind": "text", "text": "Protocol tutorial"}],
            }
        )

        # Extract the result
        task = response.result
        agent_reply = task.status.message.parts[0].root.text
        print(f"Agent replied: {agent_reply}")


asyncio.run(main())
```

```bash
python consumer.py
```

```
Connected to: Reverse Agent
Skills: ['Reverse Text']
Agent replied: lairotut locotorP
```

Your consumer agent discovered the remote agent's capabilities, sent it a task, and got a result — all using the standard A2A protocol.

## Step 10: The Google ADK shortcut

If you're using Google's Agent Development Kit, everything above collapses to a few lines. The ADK handles Agent Card generation, server setup, and JSON-RPC wiring automatically:

```python
# adk_agent.py
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

agent = Agent(
    model="gemini-2.0-flash",
    name="smart_reverse",
    description="Reverses text using Gemini for creative responses",
    instruction="Reverse whatever text the user sends you. Be creative about it.",
)

app = to_a2a(agent, port=8001)
```

```bash
uvicorn adk_agent:app --host localhost --port 8001
```

Same A2A protocol, same discoverability, same client compatibility — but with an LLM powering the responses. See the [Google ADK stack](/stacks/google-adk-stack) for full setup details.

## What you built

In 15 minutes you:

1. Created an A2A-compliant agent with the Python SDK
2. Published a discoverable Agent Card at `/.well-known/agent-card.json`
3. Handled `message/send` and `message/stream` requests
4. Tested with curl
5. Built a consumer that discovers and calls your agent programmatically
6. Saw how Google ADK simplifies the same thing

## Next steps

- [A2A Python SDK: Complete Guide](/blog/a2a-python-sdk-guide) — deeper coverage of streaming, push notifications, error handling
- [How to Deploy an A2A Agent to Production](/blog/deploy-a2a-agent-production) — Docker, TLS, monitoring, the works
- [Agent Card JSON Schema Reference](/blog/a2a-agent-card-json-schema) — every field explained
- Browse the [agent directory](/agents) to see what other people are building
- Pick a [framework stack](/stacks) to integrate A2A with your preferred tooling
