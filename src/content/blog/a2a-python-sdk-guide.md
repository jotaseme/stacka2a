---
title: "A2A Python SDK: Complete Guide with Examples"
description: "Everything you need to build A2A agents and clients in Python. Server setup, client usage, streaming, push notifications, error handling, testing, and Google ADK integration."
date: "2026-02-26"
readingTime: 11
tags: ["a2a", "python", "sdk", "tutorial"]
relatedStacks: ["google-adk-stack"]
---

The `a2a-sdk` Python package gives you both sides of the A2A protocol: server components for building agents and client components for consuming them. This guide covers everything in the SDK with working code.

## Installation

```bash
pip install a2a-sdk fastapi uvicorn
```

For Google ADK integration:

```bash
pip install "google-adk[a2a]"
```

## Creating a server

An A2A server needs four components: an `AgentExecutor`, an `AgentCard`, a `TaskStore`, and a request handler:

```python
# server.py
import asyncio
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.server.apps import A2AFastAPIApplication
from a2a.types import (
    AgentCard, AgentCapabilities, AgentSkill,
    Task, TaskStatus, TaskState, TaskStatusUpdateEvent,
)
from a2a.utils.message import new_agent_text_message


class SummaryAgent(AgentExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue):
        user_text = context.message.parts[0].root.text

        await event_queue.put(TaskStatusUpdateEvent(
            task_id=context.task_id,
            context_id=context.context_id,
            status=TaskStatus(state=TaskState.working),
            final=False,
        ))

        words = user_text.split()
        summary = " ".join(words[: max(len(words) // 3, 5)]) + "..."

        await event_queue.put(Task(
            id=context.task_id,
            context_id=context.context_id,
            status=TaskStatus(
                state=TaskState.completed,
                message=new_agent_text_message(
                    f"Summary: {summary}",
                    context.context_id, context.task_id,
                ),
            ),
        ))

    async def cancel(self, context: RequestContext, event_queue: EventQueue):
        await event_queue.put(Task(
            id=context.task_id,
            context_id=context.context_id,
            status=TaskStatus(state=TaskState.canceled),
        ))


agent_card = AgentCard(
    name="Summary Agent",
    description="Summarizes text input into shorter form.",
    url="http://localhost:8000",
    version="1.0.0",
    capabilities=AgentCapabilities(streaming=True, pushNotifications=False),
    skills=[AgentSkill(
        id="summarize", name="Summarize Text",
        description="Takes long text and returns a shorter summary.",
        tags=["text", "summarization"],
    )],
    default_input_modes=["text/plain"],
    default_output_modes=["text/plain"],
)

handler = DefaultRequestHandler(
    agent_executor=SummaryAgent(),
    task_store=InMemoryTaskStore(),
)
app = A2AFastAPIApplication(agent_card, handler).build()
```

```bash
uvicorn server:app --port 8000
```

### The AgentExecutor interface

Two methods to implement:

- **`execute(context, event_queue)`** — handles incoming messages, puts results on the queue
- **`cancel(context, event_queue)`** — handles task cancellation

The `RequestContext` gives you `task_id`, `context_id` (for multi-turn), `message` (the incoming `Message`), and `task` (current `Task` if resuming).

### Task states

```
submitted -> working -> completed
                     -> failed
                     -> input-required -> working -> completed
                     -> canceled
```

Report states by putting events on the queue. Use `TaskStatusUpdateEvent` with `final=False` for intermediate updates, and `Task` for terminal states:

```python
# Ask for more input (multi-turn)
await event_queue.put(Task(
    id=context.task_id, context_id=context.context_id,
    status=TaskStatus(
        state=TaskState.input_required,
        message=new_agent_text_message(
            "Which format? JSON or plain text?",
            context.context_id, context.task_id,
        ),
    ),
))
```

The `input-required` state is how you build multi-turn agents. The client sees it and sends a follow-up with the same `context_id`.

## Creating a client

### Basic send

```python
import asyncio
from a2a.client import A2AClient

async def main():
    async with A2AClient(url="http://localhost:8000") as client:
        card = await client.get_agent_card()
        print(f"Agent: {card.name}, streaming={card.capabilities.streaming}")

        response = await client.send_message(message={
            "role": "user",
            "parts": [{"kind": "text", "text": "Summarize the A2A protocol."}],
        })

        task = response.result
        print(f"Result: {task.status.message.parts[0].root.text}")

asyncio.run(main())
```

### Using ClientFactory

`ClientFactory` auto-discovers the agent card and negotiates the best transport:

```python
from a2a.client import ClientFactory, create_text_message_object

async def main():
    client = await ClientFactory.connect("http://localhost:8000")
    try:
        message = create_text_message_object(content="Explain A2A in one sentence.")
        async for event in client.send_message(message):
            if isinstance(event, tuple):
                task, update = event
                if task.status.state == "completed":
                    print(task.status.message.parts[0].root.text)
    finally:
        await client.close()
```

## Streaming

Streaming uses Server-Sent Events. Put multiple events for chunked responses:

```python
class StreamingAgent(AgentExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue):
        user_text = context.message.parts[0].root.text

        await event_queue.put(TaskStatusUpdateEvent(
            task_id=context.task_id, context_id=context.context_id,
            status=TaskStatus(state=TaskState.working), final=False,
        ))

        chunks = ["Processing... ", "Analyzing... ", "Done."]
        accumulated = ""

        for i, chunk in enumerate(chunks):
            await asyncio.sleep(0.3)
            accumulated += chunk

            if i == len(chunks) - 1:
                await event_queue.put(Task(
                    id=context.task_id, context_id=context.context_id,
                    status=TaskStatus(
                        state=TaskState.completed,
                        message=new_agent_text_message(
                            accumulated, context.context_id, context.task_id,
                        ),
                    ),
                ))
            else:
                await event_queue.put(TaskStatusUpdateEvent(
                    task_id=context.task_id, context_id=context.context_id,
                    status=TaskStatus(
                        state=TaskState.working,
                        message=new_agent_text_message(
                            accumulated, context.context_id, context.task_id,
                        ),
                    ),
                    final=False,
                ))
```

### Client-side streaming

```python
from a2a.client import ClientFactory, create_text_message_object
from a2a.types import TaskState

async def stream_response():
    client = await ClientFactory.connect("http://localhost:8000")
    try:
        message = create_text_message_object(content="Detailed analysis please.")
        async for event in client.send_message(message):
            if isinstance(event, tuple):
                task, update = event
                if task.status.state == TaskState.working and task.status.message:
                    print(f"[working] {task.status.message.parts[0].root.text}")
                elif task.status.state == TaskState.completed:
                    print(f"[done] {task.status.message.parts[0].root.text}")
                    break
    finally:
        await client.close()
```

## Push notifications

For long-running tasks, register a webhook instead of holding an SSE connection:

```python
from a2a.types import PushNotificationConfig

# Set pushNotifications=True in your AgentCard capabilities, then:
config = PushNotificationConfig(
    url="https://my-app.example.com/webhooks/a2a",
    events=["task.completed", "task.failed"],
)
await client.create_push_notification_config(task_id=task.id, config=config)
```

The agent POSTs task updates to your webhook URL as JSON.

## Error handling

Catch errors on the client side. Report errors through task state on the server side:

```python
# Client-side
from a2a.types import A2AError
import httpx

async def safe_send(url: str, text: str):
    try:
        async with A2AClient(url=url) as client:
            response = await client.send_message(
                message={"role": "user", "parts": [{"kind": "text", "text": text}]}
            )
            task = response.result
            if task.status.state == "failed":
                print(f"Task failed: {task.status.message}")
                return None
            return task
    except httpx.ConnectError:
        print(f"Cannot connect to {url}")
    except A2AError as e:
        print(f"A2A protocol error: {e}")
    return None
```

```python
# Server-side — report errors as failed tasks, don't raise
class RobustAgent(AgentExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue):
        try:
            user_text = context.message.parts[0].root.text
            result = self.process(user_text)
            await event_queue.put(Task(
                id=context.task_id, context_id=context.context_id,
                status=TaskStatus(
                    state=TaskState.completed,
                    message=new_agent_text_message(result, context.context_id, context.task_id),
                ),
            ))
        except Exception as e:
            await event_queue.put(Task(
                id=context.task_id, context_id=context.context_id,
                status=TaskStatus(
                    state=TaskState.failed,
                    message=new_agent_text_message(
                        f"Error: {e}", context.context_id, context.task_id,
                    ),
                ),
            ))
```

## Testing agents

```python
# test_agent.py
import pytest
import httpx

BASE_URL = "http://localhost:8000"

def test_agent_card():
    response = httpx.get(f"{BASE_URL}/.well-known/agent-card.json")
    assert response.status_code == 200
    card = response.json()
    assert "name" in card
    assert len(card["skills"]) > 0

def test_message_send():
    payload = {
        "jsonrpc": "2.0", "id": "test-1",
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"kind": "text", "text": "Test input"}],
            }
        },
    }
    response = httpx.post(BASE_URL, json=payload, timeout=30)
    assert response.status_code == 200
    result = response.json()
    assert result["result"]["status"]["state"] == "completed"
```

## Google ADK integration

The ADK wraps all server boilerplate into one function call:

```python
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

agent = Agent(
    model="gemini-2.0-flash",
    name="research_helper",
    description="Answers research questions with structured analysis.",
    instruction="Provide clear, well-structured answers.",
)
app = to_a2a(agent, port=8001)
```

To consume an ADK agent from another ADK agent:

```python
from google.adk import Agent
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent

remote = RemoteA2aAgent(
    name="remote_research",
    description="Remote research assistant",
    agent_card_url="http://localhost:8001/.well-known/agent-card.json",
)
coordinator = Agent(
    model="gemini-2.0-flash",
    name="coordinator",
    description="Delegates research tasks to remote agents.",
    instruction="Delegate research questions to the remote_research agent.",
    sub_agents=[remote],
)
```

See the [Google ADK stack page](/stacks/google-adk-stack) for full setup and advanced patterns.

## Next steps

- [A2A Protocol Tutorial](/blog/a2a-protocol-tutorial-beginners) — the quick-start version
- [A2A TypeScript SDK Guide](/blog/a2a-typescript-sdk-guide) — TypeScript server and client implementations
- [Deploy to Production](/blog/deploy-a2a-agent-production) — Docker, TLS, health checks, monitoring
- [Agent Card JSON Schema Reference](/blog/a2a-agent-card-json-schema) — every field documented
- Browse [agents](/agents) and [stacks](/stacks) for real-world examples
