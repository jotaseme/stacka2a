---
title: "Testing and Debugging A2A Agents"
description: "How to test A2A agents: unit testing skills, integration testing with mock clients, testing streaming, multi-turn flows, debugging with curl, logging patterns, and common error codes."
date: "2026-03-22"
readingTime: 9
tags: ["a2a", "testing", "debugging", "python"]
relatedStacks: ["google-adk-stack"]
relatedAgents: []
---

A2A agents are HTTP services that wrap LLMs. Testing them means testing at three levels: the tools/skills independently, the A2A protocol layer, and the agent behavior end-to-end. Most teams skip the first two and only test end-to-end, which is why debugging takes forever.

## Testing strategy

| Level | What you test | Speed | Determinism |
|-------|--------------|-------|-------------|
| Unit | Individual tools/functions | Fast | High |
| Integration | A2A protocol compliance | Medium | High |
| End-to-end | Full agent behavior | Slow | Low |

Test from the bottom up. If your tools work and your protocol layer works, end-to-end issues are almost always prompt engineering problems.

## Unit testing tools

Your agent's tools are regular Python functions. Test them like any other function.

```python
# test_tools.py
import pytest
from agent import check_service_status, search_knowledge_base


def test_check_known_service():
    result = check_service_status("nginx")
    assert "Running" in result
    assert "CPU" in result


def test_check_unknown_service():
    result = check_service_status("nonexistent")
    assert "not found" in result


def test_kb_search_match():
    result = search_knowledge_base("connection refused")
    assert "KB-1042" in result
    assert "ss -tlnp" in result


def test_kb_search_no_match():
    result = search_knowledge_base("alien invasion")
    assert "No articles found" in result
    assert "Escalate" in result


def test_kb_search_category_filter():
    result = search_knowledge_base("ssl certificate", category="networking")
    assert "KB-1156" in result
```

Run them with pytest:

```bash
pytest test_tools.py -v
```

This catches 90% of bugs. If `check_service_status` returns malformed output, the LLM will give garbage answers regardless of how good your prompt is.

## Integration testing the A2A layer

Test that your agent correctly implements the A2A protocol: valid JSON-RPC responses, correct task states, proper error codes.

```python
# test_a2a.py
import pytest
import httpx
import asyncio
import json

BASE_URL = "http://localhost:8001"


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.mark.asyncio
async def test_agent_card_exists():
    """Agent Card must be served at the well-known path."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/.well-known/agent-card.json")
    assert resp.status_code == 200
    card = resp.json()
    assert "name" in card
    assert "url" in card
    assert "capabilities" in card
    assert "skills" in card
    assert isinstance(card["skills"], list)


@pytest.mark.asyncio
async def test_agent_card_valid_url():
    """The url field should point to the A2A endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/.well-known/agent-card.json")
    card = resp.json()
    assert card["url"].startswith("http")


@pytest.mark.asyncio
async def test_message_send():
    """message/send must return a valid task with artifacts."""
    payload = {
        "jsonrpc": "2.0",
        "id": "test-send-1",
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": "What is 2 + 2?"}],
            }
        },
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(BASE_URL, json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["jsonrpc"] == "2.0"
    assert data["id"] == "test-send-1"
    assert "result" in data

    result = data["result"]
    assert "id" in result  # Task ID
    assert result["status"]["state"] in ("completed", "working")
    if result["status"]["state"] == "completed":
        assert len(result.get("artifacts", [])) > 0


@pytest.mark.asyncio
async def test_invalid_method():
    """Unknown methods should return JSON-RPC method not found error."""
    payload = {
        "jsonrpc": "2.0",
        "id": "test-invalid",
        "method": "nonexistent/method",
        "params": {},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(BASE_URL, json=payload)
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == -32601  # Method not found


@pytest.mark.asyncio
async def test_malformed_request():
    """Malformed JSON-RPC should return parse error or invalid request."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            BASE_URL,
            json={"not": "valid jsonrpc"},
        )
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] in (-32600, -32700)  # Invalid request or parse error
```

Run these against a live agent:

```bash
# Terminal 1: Start the agent
uvicorn agent:a2a_app --port 8001

# Terminal 2: Run tests
pytest test_a2a.py -v
```

## Testing streaming

Streaming tests need to parse SSE events. Here is a helper and test:

```python
# test_streaming.py
import pytest
import httpx
import asyncio
import json


async def collect_sse_events(url: str, payload: dict, timeout: float = 30) -> list[dict]:
    """Send a streaming request and collect all SSE events."""
    events = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            url,
            json=payload,
            headers={"Accept": "text/event-stream"},
        ) as response:
            buffer = ""
            async for chunk in response.aiter_text():
                buffer += chunk
                while "\n\n" in buffer:
                    event_str, buffer = buffer.split("\n\n", 1)
                    for line in event_str.split("\n"):
                        if line.startswith("data: "):
                            data = line[6:]
                            try:
                                events.append(json.loads(data))
                            except json.JSONDecodeError:
                                pass  # Skip non-JSON lines
    return events


@pytest.mark.asyncio
async def test_message_stream():
    """message/stream should return SSE events with task updates."""
    payload = {
        "jsonrpc": "2.0",
        "id": "test-stream-1",
        "method": "message/stream",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": "Explain DNS in one sentence."}],
            }
        },
    }
    events = await collect_sse_events("http://localhost:8001", payload)

    assert len(events) > 0, "Should receive at least one SSE event"

    # Check that we get status updates
    states = []
    for event in events:
        result = event.get("result", {})
        state = result.get("status", {}).get("state")
        if state:
            states.append(state)

    # Should end with 'completed'
    assert states[-1] == "completed", f"Final state should be 'completed', got {states}"


@pytest.mark.asyncio
async def test_stream_contains_artifacts():
    """Streaming should eventually produce artifacts."""
    payload = {
        "jsonrpc": "2.0",
        "id": "test-stream-2",
        "method": "message/stream",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": "Say hello."}],
            }
        },
    }
    events = await collect_sse_events("http://localhost:8001", payload)

    has_artifacts = any(
        len(event.get("result", {}).get("artifacts", [])) > 0
        for event in events
    )
    assert has_artifacts, "Streaming response should contain artifacts"
```

## Testing multi-turn conversations

Multi-turn requires passing `contextId` between requests. Test that the agent maintains conversation state:

```python
# test_multi_turn.py
import pytest
import httpx
import asyncio

BASE_URL = "http://localhost:8001"


@pytest.mark.asyncio
async def test_multi_turn_context():
    """Agent should maintain context across turns using contextId."""
    # Turn 1: Establish context
    turn1_payload = {
        "jsonrpc": "2.0",
        "id": "mt-1",
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": "My server name is web-prod-3."}],
            }
        },
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp1 = await client.post(BASE_URL, json=turn1_payload)
    result1 = resp1.json()["result"]
    context_id = result1.get("contextId")
    task_id = result1.get("id")

    assert context_id is not None, "First response should include a contextId"

    # Turn 2: Reference previous context
    turn2_payload = {
        "jsonrpc": "2.0",
        "id": "mt-2",
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": "Check the status of that server."}],
                "contextId": context_id,
            }
        },
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp2 = await client.post(BASE_URL, json=turn2_payload)
    result2 = resp2.json()["result"]

    # The agent should reference web-prod-3 from the previous turn
    artifacts = result2.get("artifacts", [])
    text = " ".join(
        part["text"]
        for a in artifacts
        for part in a.get("parts", [])
        if part.get("type") == "text"
    )
    # The agent should have remembered the server name
    assert len(text) > 0, "Second turn should produce a response"
```

## Debugging with curl

When tests fail, drop to curl for manual debugging. These are the commands you will use most.

### Check the Agent Card

```bash
curl -s http://localhost:8001/.well-known/agent-card.json | python -m json.tool
```

If this fails, the server is not running or the path is misconfigured.

### Send a minimal request

```bash
curl -s -X POST http://localhost:8001/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "debug-1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "hello"}]
      }
    }
  }' | python -m json.tool
```

### Check for JSON-RPC errors

```bash
# Intentionally send a bad method to verify error handling
curl -s -X POST http://localhost:8001/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": "1", "method": "bad/method", "params": {}}' \
  | python -m json.tool
```

Expected response:

```json
{
    "jsonrpc": "2.0",
    "id": "1",
    "error": {
        "code": -32601,
        "message": "Method not found"
    }
}
```

### Watch streaming output

```bash
curl -N -X POST http://localhost:8001/ \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/stream",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "hello"}]
      }
    }
  }'
```

## Logging patterns

Add structured logging to your agent for production debugging:

```python
# logging_config.py
import logging
import json
import time
from starlette.requests import Request

logger = logging.getLogger("a2a_agent")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(handler)


def log_request(request_id: str, method: str, params: dict):
    """Log incoming A2A request (without sensitive content)."""
    message_parts = params.get("message", {}).get("parts", [])
    text_length = sum(
        len(p.get("text", "")) for p in message_parts if p.get("type") == "text"
    )
    logger.info(json.dumps({
        "event": "request",
        "request_id": request_id,
        "method": method,
        "text_length": text_length,
        "has_context": "contextId" in params.get("message", {}),
        "timestamp": time.time(),
    }))


def log_response(request_id: str, state: str, duration_ms: float):
    """Log outgoing A2A response."""
    logger.info(json.dumps({
        "event": "response",
        "request_id": request_id,
        "state": state,
        "duration_ms": round(duration_ms, 2),
        "timestamp": time.time(),
    }))


def log_tool_call(request_id: str, tool_name: str, duration_ms: float, success: bool):
    """Log tool invocations."""
    logger.info(json.dumps({
        "event": "tool_call",
        "request_id": request_id,
        "tool": tool_name,
        "duration_ms": round(duration_ms, 2),
        "success": success,
        "timestamp": time.time(),
    }))
```

Key rules:
- Log the request ID on every line so you can trace a request across log entries.
- Log text length, not text content. You do not want user messages in your log pipeline.
- Log tool call duration. Slow tools are the most common performance problem.
- Use structured JSON logs. They are searchable and parseable by log aggregation tools.

## Common A2A error codes

When debugging, these are the JSON-RPC error codes you will encounter:

| Code | Name | Meaning |
|------|------|---------|
| -32700 | Parse error | Request body is not valid JSON |
| -32600 | Invalid request | Valid JSON but not a valid JSON-RPC request |
| -32601 | Method not found | Unknown method (e.g., typo in `message/send`) |
| -32602 | Invalid params | Method exists but params are malformed |
| -32603 | Internal error | Server-side failure (LLM timeout, tool crash) |
| -32001 | Authentication error | Missing or invalid credentials |
| -32002 | Task not found | Referenced task ID does not exist |
| -32003 | Insufficient scope | Valid auth but missing required permissions |

When you get `-32603`, check the server logs. It usually means an unhandled exception in a tool function or an LLM API timeout.

## Putting it together

A minimal `Makefile` for running all test levels:

```makefile
.PHONY: test-unit test-integration test-e2e test-all

test-unit:
	pytest test_tools.py -v

test-integration:
	pytest test_a2a.py test_streaming.py -v

test-e2e:
	pytest test_multi_turn.py -v

test-all: test-unit test-integration test-e2e
```

Run unit tests in CI on every commit. Run integration tests against a staging agent. Run end-to-end tests before releases.

## Further reading

- [Error Handling Patterns](/blog/a2a-error-handling-patterns) -- handling and recovering from the errors you will find
- [Google ADK Tutorial](/blog/google-adk-tutorial-2026) -- building the agents you are testing
- [Building Multi-Agent Systems](/blog/multi-agent-system-a2a) -- testing gets harder with multiple agents
- Browse tested agent implementations on [StackA2A](/agents)
