---
title: "A2A Streaming: SSE, Partial Updates, and Real-Time Agents"
description: "Deep dive on SSE streaming in A2A: the message/stream method, event format, partial task updates, client-side handling, error recovery, and when to use streaming vs polling."
date: "2026-03-06"
readingTime: 9
tags: ["a2a", "streaming", "sse", "real-time"]
relatedStacks: ["google-adk-stack"]
---

A2A supports two ways to get a response from an agent: `message/send` (wait for the full result) and `message/stream` (get partial updates as the agent works). Most tutorials show `message/send`. Production systems need `message/stream`.

When an agent takes 30 seconds to research a topic, generate code, or coordinate with sub-agents, your user is staring at a spinner. Streaming fixes that. The agent pushes status changes and partial results as they happen, over Server-Sent Events (SSE).

## How SSE works in A2A

SSE is a one-way channel from server to client over HTTP. The client makes a POST request with `Accept: text/event-stream`, and the server holds the connection open, pushing events as newline-delimited text.

A2A uses SSE specifically for the `message/stream` method. The flow:

1. Client sends a JSON-RPC request with `method: "message/stream"`
2. Server responds with `Content-Type: text/event-stream`
3. Server pushes `TaskStatusUpdateEvent` and `TaskArtifactUpdateEvent` as the agent works
4. Final event contains the completed task
5. Connection closes

```
Client                              Agent Server
  |                                      |
  |-- POST message/stream ------------->|
  |   Accept: text/event-stream         |
  |                                      |
  |<-- 200 OK                           |
  |    Content-Type: text/event-stream   |
  |                                      |
  |<-- event: TaskStatusUpdateEvent      |  (state: working)
  |<-- event: TaskStatusUpdateEvent      |  (partial message)
  |<-- event: TaskArtifactUpdateEvent    |  (partial artifact)
  |<-- event: TaskStatusUpdateEvent      |  (partial message)
  |<-- event: TaskArtifactUpdateEvent    |  (complete artifact)
  |<-- event: TaskStatusUpdateEvent      |  (state: completed)
  |                                      |
  |    [connection closes]               |
```

## The request

A `message/stream` request is identical to `message/send` except for the method name:

```json
{
  "jsonrpc": "2.0",
  "id": "req-stream-1",
  "method": "message/stream",
  "params": {
    "id": "task-xyz-789",
    "message": {
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "Analyze the performance characteristics of B-tree vs LSM-tree indexes"
        }
      ]
    }
  }
}
```

The `id` in `params` is the task ID. If you send a new message with the same task ID, it continues the conversation (multi-turn). New task ID starts a new task.

## Event format

Each SSE event is a JSON-RPC notification (no `id` field) with either a status update or an artifact update.

### TaskStatusUpdateEvent

Sent when the task state changes or the agent produces a status message:

```
event: message
data: {
  "jsonrpc": "2.0",
  "method": "tasks/statusUpdate",
  "params": {
    "id": "task-xyz-789",
    "status": {
      "state": "working",
      "message": {
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "Researching B-tree index structures..."
          }
        ]
      }
    },
    "final": false
  }
}
```

Key fields:
- **`state`** — one of `submitted`, `working`, `input-required`, `completed`, `failed`, `canceled`
- **`message`** — optional status message from the agent (partial text, progress updates)
- **`final`** — `true` on the last event. When you see `final: true`, the stream is done.

### TaskArtifactUpdateEvent

Sent when the agent produces output:

```
event: message
data: {
  "jsonrpc": "2.0",
  "method": "tasks/artifactUpdate",
  "params": {
    "id": "task-xyz-789",
    "artifact": {
      "index": 0,
      "parts": [
        {
          "kind": "text",
          "text": "## B-tree vs LSM-tree Performance\n\nB-trees optimize for read performance..."
        }
      ],
      "append": false,
      "lastChunk": false
    }
  }
}
```

Key fields:
- **`index`** — which artifact this chunk belongs to (agents can produce multiple artifacts)
- **`append`** — if `true`, concatenate this to the previous chunk for the same artifact index. If `false`, replace it.
- **`lastChunk`** — `true` when this artifact is complete

The `append` flag is critical. When an agent streams text token by token, each chunk has `append: true`, and you build up the full text by concatenation. When an agent sends a revised version of the whole artifact, `append: false` tells you to replace what you had.

## Python client implementation

Here's a working streaming client using `httpx`:

```python
import httpx
import json
from dataclasses import dataclass

@dataclass
class StreamEvent:
    event_type: str  # "status" or "artifact"
    task_id: str
    data: dict

async def stream_task(
    agent_url: str,
    task_id: str,
    message_text: str,
    headers: dict | None = None,
):
    """Stream a task and yield events as they arrive."""
    request_body = {
        "jsonrpc": "2.0",
        "id": f"req-{task_id}",
        "method": "message/stream",
        "params": {
            "id": task_id,
            "message": {
                "role": "user",
                "parts": [{"kind": "text", "text": message_text}],
            },
        },
    }

    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST",
            agent_url,
            json=request_body,
            headers={
                "Accept": "text/event-stream",
                "Content-Type": "application/json",
                **(headers or {}),
            },
        ) as response:
            response.raise_for_status()

            buffer = ""
            async for chunk in response.aiter_text():
                buffer += chunk
                while "\n\n" in buffer:
                    event_text, buffer = buffer.split("\n\n", 1)
                    event = parse_sse_event(event_text)
                    if event:
                        yield event


def parse_sse_event(event_text: str) -> StreamEvent | None:
    """Parse a raw SSE event into a StreamEvent."""
    data_lines = []
    for line in event_text.strip().split("\n"):
        if line.startswith("data: "):
            data_lines.append(line[6:])
        elif line.startswith("data:"):
            data_lines.append(line[5:])

    if not data_lines:
        return None

    raw = json.loads("".join(data_lines))
    method = raw.get("method", "")
    params = raw.get("params", {})

    if method == "tasks/statusUpdate":
        return StreamEvent(
            event_type="status",
            task_id=params["id"],
            data=params,
        )
    elif method == "tasks/artifactUpdate":
        return StreamEvent(
            event_type="artifact",
            task_id=params["id"],
            data=params,
        )
    return None
```

Usage:

```python
import asyncio

async def main():
    artifacts = {}

    async for event in stream_task("http://localhost:8001", "task-001", "Explain connection pooling"):
        if event.event_type == "status":
            state = event.data["status"]["state"]
            print(f"[{state}]", end=" ")
            if event.data.get("final"):
                print("\n--- Stream complete ---")

        elif event.event_type == "artifact":
            artifact = event.data["artifact"]
            idx = artifact["index"]
            text = artifact["parts"][0].get("text", "")
            if artifact.get("append", False) and idx in artifacts:
                artifacts[idx] += text
            else:
                artifacts[idx] = text

    for idx in sorted(artifacts):
        print(artifacts[idx])

asyncio.run(main())
```

## Error recovery

SSE connections drop. Networks flake. Agents crash. You need to handle this.

The pattern: catch connection errors, apply exponential backoff, and before re-streaming, check the task status with `tasks/get` — the agent might have finished while you were disconnected.

```python
import asyncio

async def stream_with_retry(agent_url, task_id, message_text, max_retries=3):
    """Stream with exponential backoff retry on connection failures."""
    for attempt in range(max_retries + 1):
        try:
            async for event in stream_task(agent_url, task_id, message_text):
                yield event
                if event.event_type == "status" and event.data.get("final"):
                    return
        except (httpx.ReadTimeout, httpx.ConnectError):
            if attempt == max_retries:
                raise

        # Backoff, then check if the task finished while disconnected
        await asyncio.sleep(2 ** attempt)
        status = await check_task_status(agent_url, task_id)
        if status["status"]["state"] in ("completed", "failed", "canceled"):
            yield StreamEvent("status", task_id, status)
            return

async def check_task_status(agent_url: str, task_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(agent_url, json={
            "jsonrpc": "2.0", "id": f"status-{task_id}",
            "method": "tasks/get", "params": {"id": task_id},
        })
        return resp.json()["result"]
```

## Streaming vs polling: when to use each

Use **`message/stream`** when:
- The user is watching — they need to see progress
- Tasks take more than 2-3 seconds
- You want to show partial results (token-by-token text, incremental code generation)
- The agent goes through visible stages (researching, analyzing, writing)

Use **`message/send`** when:
- You're calling the agent from a background job
- The result is small and fast (< 2 seconds)
- Your infrastructure doesn't support long-lived HTTP connections (some API gateways, serverless)
- You just need the final answer

Use **`tasks/get` polling** when:
- You can't hold an HTTP connection open (webhook-based architectures)
- The agent supports push notifications (the agent POSTs to your webhook when done)
- You need to check on a task submitted earlier

### Push notifications as an alternative

For truly long-running tasks (minutes to hours), neither streaming nor polling is great. A2A's push notification capability lets the agent call back to you:

```json
{
  "jsonrpc": "2.0",
  "id": "req-long-task",
  "method": "message/send",
  "params": {
    "id": "task-long-001",
    "message": {
      "role": "user",
      "parts": [{ "kind": "text", "text": "Generate a full security audit report" }]
    },
    "pushNotification": {
      "url": "https://my-app.example.com/webhooks/a2a",
      "authentication": {
        "schemes": ["bearer"],
        "credentials": "webhook-secret-token"
      }
    }
  }
}
```

The agent must declare `pushNotifications: true` in its [Agent Card](/blog/a2a-agent-card-explained) capabilities. Check before sending.

## Server-side: emitting SSE events

If you're building an A2A agent with streaming support, the pattern is straightforward. Return a `StreamingResponse` with `text/event-stream` content type and yield JSON-RPC notifications formatted as SSE:

```python
from starlette.responses import StreamingResponse
import json

def format_sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"

async def handle_stream(task_id: str, message: dict):
    async def event_generator():
        yield format_sse({
            "jsonrpc": "2.0",
            "method": "tasks/statusUpdate",
            "params": {"id": task_id, "status": {"state": "working"}, "final": False},
        })

        async for token in generate_response(message):
            yield format_sse({
                "jsonrpc": "2.0",
                "method": "tasks/artifactUpdate",
                "params": {
                    "id": task_id,
                    "artifact": {
                        "index": 0,
                        "parts": [{"kind": "text", "text": token}],
                        "append": True,
                        "lastChunk": False,
                    },
                },
            })

        yield format_sse({
            "jsonrpc": "2.0",
            "method": "tasks/statusUpdate",
            "params": {"id": task_id, "status": {"state": "completed"}, "final": True},
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

The key details: send a `working` status first, stream artifact chunks with `append: True`, then close with a `completed` status with `final: True`. The `X-Accel-Buffering: no` header prevents nginx from buffering your events.

## Common pitfalls

**Proxy buffering kills streaming.** Nginx, Cloudflare, and most reverse proxies buffer responses by default. You need `X-Accel-Buffering: no` for nginx, and equivalent settings for your proxy. Without this, your SSE events arrive in batches instead of in real time.

**Set appropriate timeouts.** Streaming connections live longer than normal HTTP requests. Set your HTTP client timeout to match the maximum expected task duration, not the default 30 seconds.

**Don't forget `final: true`.** The client relies on the `final` flag to know when the stream is done. If your agent crashes before sending it, the client hangs until timeout. Implement cleanup handlers that send a `failed` status on unhandled exceptions.

**Handle `input-required` in streams.** An agent might stream back `state: "input-required"` mid-stream. This means the agent needs more information. The stream pauses, and your client should prompt the user, then send a follow-up `message/stream` with the same task ID. See [Multi-Turn Conversations](/blog/a2a-multi-turn-conversations) for the full pattern.

Streaming is what makes A2A agents feel responsive. The protocol gets the mechanics right — SSE is well-supported, the event format is clean, and the `append`/`lastChunk` semantics handle incremental output naturally. The hard part is the infrastructure: proxy config, timeout tuning, and reconnection logic. Get those right and your agents go from "submitted... waiting... done" to a live, interactive experience.

Browse agents that support streaming in the [agent directory](/agents), or get started with the [Google ADK stack](/stacks/google-adk-stack) which enables streaming by default.
