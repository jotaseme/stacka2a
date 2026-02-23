---
title: "Error Handling Patterns for A2A Agents"
description: "JSON-RPC error codes, custom error responses, retry strategies, timeout handling, graceful degradation, and error propagation across multi-agent chains."
date: "2026-03-24"
readingTime: 8
tags: ["a2a", "error-handling", "patterns", "guide"]
relatedStacks: []
relatedAgents: []
---

A2A agents fail. LLMs time out, tools crash, downstream agents go offline, tokens expire mid-request. The difference between a demo and a production system is how failures are handled.

A2A uses JSON-RPC 2.0, which has a well-defined error format. Build on it correctly and your agents fail gracefully. Ignore it and your multi-agent system becomes a cascade of cryptic 500 errors.

## JSON-RPC error format

Every A2A error response follows this structure:

```json
{
  "jsonrpc": "2.0",
  "id": "request-123",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "detail": "LLM provider returned 503",
      "retryable": true,
      "retryAfter": 5
    }
  }
}
```

The `code` and `message` are required by JSON-RPC. The `data` field is optional but essential for production -- use it to tell clients whether the error is retryable, how long to wait, and what went wrong.

## Standard error codes

JSON-RPC defines a set of standard codes. A2A agents should use these consistently:

| Code | Name | Your agent should return this when... |
|------|------|---------------------------------------|
| -32700 | Parse error | The request body is not valid JSON |
| -32600 | Invalid request | Valid JSON but missing `jsonrpc`, `method`, or `id` |
| -32601 | Method not found | Client calls a method you do not support |
| -32602 | Invalid params | Message format is wrong (missing `parts`, bad `role`) |
| -32603 | Internal error | Anything else: LLM failure, tool crash, unexpected exception |

## Custom error codes for A2A

The JSON-RPC spec reserves -32000 to -32099 for server-defined errors. Use these for A2A-specific failures:

```python
# errors.py
from enum import IntEnum


class A2AErrorCode(IntEnum):
    AUTH_REQUIRED = -32001
    TASK_NOT_FOUND = -32002
    INSUFFICIENT_SCOPE = -32003
    RATE_LIMITED = -32004
    AGENT_UNAVAILABLE = -32005
    TASK_TIMEOUT = -32006
    CONTENT_TOO_LARGE = -32007
    SKILL_NOT_FOUND = -32008


def make_error(code: int, message: str, data: dict | None = None) -> dict:
    """Create a JSON-RPC error response."""
    error = {"code": code, "message": message}
    if data:
        error["data"] = data
    return error
```

### Applying them in your request handler

```python
# handler.py
from starlette.requests import Request
from starlette.responses import JSONResponse
from errors import A2AErrorCode, make_error
import json


async def a2a_handler(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except json.JSONDecodeError:
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": None,
            "error": make_error(-32700, "Parse error: invalid JSON"),
        })

    request_id = body.get("id")
    method = body.get("method")
    params = body.get("params", {})

    # Validate JSON-RPC structure
    if not body.get("jsonrpc") == "2.0" or not method or request_id is None:
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": make_error(-32600, "Invalid JSON-RPC request"),
        })

    # Route to handler
    if method == "message/send":
        return await handle_message_send(request_id, params)
    elif method == "message/stream":
        return await handle_message_stream(request_id, params)
    elif method == "tasks/get":
        return await handle_tasks_get(request_id, params)
    else:
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": make_error(-32601, f"Method not found: {method}"),
        })


async def handle_message_send(request_id: str, params: dict) -> JSONResponse:
    message = params.get("message")
    if not message or "parts" not in message:
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": make_error(-32602, "Invalid params: message must contain parts"),
        })

    try:
        result = await process_message(message)
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result,
        })
    except TimeoutError:
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": make_error(
                A2AErrorCode.TASK_TIMEOUT,
                "Task timed out",
                {"retryable": True, "retryAfter": 10},
            ),
        })
    except Exception as e:
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": make_error(
                -32603,
                "Internal error",
                {"detail": str(e), "retryable": False},
            ),
        })
```

## Retry patterns

Not all errors are retryable. Here is how to build a client that handles them correctly.

```python
# retry_client.py
import asyncio
import httpx
import uuid
from dataclasses import dataclass

# Codes that are safe to retry
RETRYABLE_CODES = {
    -32603,  # Internal error (server-side failure)
    -32004,  # Rate limited
    -32005,  # Agent unavailable
    -32006,  # Task timeout
}

# Codes that are never retryable
NON_RETRYABLE_CODES = {
    -32700,  # Parse error (client bug)
    -32600,  # Invalid request (client bug)
    -32601,  # Method not found (client bug)
    -32602,  # Invalid params (client bug)
    -32001,  # Auth required (fix credentials first)
    -32003,  # Insufficient scope (fix permissions first)
}


@dataclass
class RetryConfig:
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 30.0
    backoff_factor: float = 2.0


async def send_with_retry(
    agent_url: str,
    text: str,
    config: RetryConfig = RetryConfig(),
) -> dict:
    """Send an A2A request with intelligent retry logic."""
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": text}],
            }
        },
    }

    last_error = None
    for attempt in range(config.max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(agent_url, json=payload)

            # HTTP-level errors
            if resp.status_code == 429:
                retry_after = float(resp.headers.get("Retry-After", config.base_delay))
                await asyncio.sleep(retry_after)
                continue

            if resp.status_code >= 500:
                if attempt < config.max_retries:
                    delay = min(
                        config.base_delay * (config.backoff_factor ** attempt),
                        config.max_delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                resp.raise_for_status()

            data = resp.json()

            # JSON-RPC level errors
            if "error" in data:
                error = data["error"]
                code = error.get("code", -32603)
                error_data = error.get("data", {})

                if code in NON_RETRYABLE_CODES:
                    raise A2AError(code, error["message"], error_data)

                if code in RETRYABLE_CODES and attempt < config.max_retries:
                    delay = error_data.get(
                        "retryAfter",
                        config.base_delay * (config.backoff_factor ** attempt),
                    )
                    delay = min(delay, config.max_delay)
                    await asyncio.sleep(delay)
                    continue

                raise A2AError(code, error["message"], error_data)

            return data

        except httpx.TimeoutException:
            last_error = TimeoutError(f"Request timed out (attempt {attempt + 1})")
            if attempt < config.max_retries:
                delay = config.base_delay * (config.backoff_factor ** attempt)
                await asyncio.sleep(delay)
                continue

        except httpx.ConnectError:
            last_error = ConnectionError(f"Agent unreachable (attempt {attempt + 1})")
            if attempt < config.max_retries:
                delay = config.base_delay * (config.backoff_factor ** attempt)
                await asyncio.sleep(delay)
                continue

    raise last_error or RuntimeError("All retries exhausted")


class A2AError(Exception):
    def __init__(self, code: int, message: str, data: dict | None = None):
        self.code = code
        self.message = message
        self.data = data or {}
        super().__init__(f"A2A Error {code}: {message}")
```

Key design decisions:
- Separate HTTP-level retries (429, 5xx) from JSON-RPC-level retries (application errors).
- Respect `Retry-After` headers and the `retryAfter` field in error data.
- Never retry client errors (-32700, -32600, -32601, -32602). Those are bugs in the caller.
- Exponential backoff with a cap. Without the cap, delay grows without bound.

## Timeout handling

Set timeouts at three levels:

```python
# timeouts.py
import asyncio
import httpx


async def send_with_timeout(
    agent_url: str,
    text: str,
    connect_timeout: float = 5.0,
    read_timeout: float = 60.0,
    total_timeout: float = 90.0,
) -> dict:
    """Send with layered timeouts."""
    payload = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": text}],
            }
        },
    }

    timeout = httpx.Timeout(
        connect=connect_timeout,   # Time to establish TCP connection
        read=read_timeout,         # Time to receive response
        write=5.0,                 # Time to send request (usually fast)
        pool=10.0,                 # Time to acquire connection from pool
    )

    try:
        async with asyncio.timeout(total_timeout):  # Overall deadline
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(agent_url, json=payload)
                return resp.json()
    except asyncio.TimeoutError:
        return {
            "jsonrpc": "2.0",
            "id": "1",
            "error": {
                "code": -32006,
                "message": "Total timeout exceeded",
                "data": {"timeout": total_timeout},
            },
        }
    except httpx.ConnectTimeout:
        return {
            "jsonrpc": "2.0",
            "id": "1",
            "error": {
                "code": -32005,
                "message": "Agent unreachable (connect timeout)",
                "data": {"timeout": connect_timeout},
            },
        }
    except httpx.ReadTimeout:
        return {
            "jsonrpc": "2.0",
            "id": "1",
            "error": {
                "code": -32006,
                "message": "Agent response timeout",
                "data": {"timeout": read_timeout},
            },
        }
```

For LLM-backed agents, `read_timeout` should be generous (30-120 seconds). LLMs are slow. But `connect_timeout` should be tight (3-5 seconds) -- if you cannot connect in 5 seconds, the agent is probably down.

## Graceful degradation

When part of a multi-agent system fails, degrade instead of crashing. Here is a pattern for a coordinator that continues working when specialists are down:

```python
# degradation.py
import asyncio
from dataclasses import dataclass, field


@dataclass
class AgentHealth:
    url: str
    healthy: bool = True
    consecutive_failures: int = 0
    last_failure: float = 0
    circuit_open_until: float = 0  # Circuit breaker timestamp


class ResilientCoordinator:
    def __init__(self, agent_urls: list[str]):
        self.agents = {url: AgentHealth(url=url) for url in agent_urls}

    def is_available(self, url: str) -> bool:
        """Check if an agent is available (circuit breaker is closed)."""
        import time
        agent = self.agents[url]
        if agent.circuit_open_until > time.time():
            return False  # Circuit is open, skip this agent
        return True

    def record_failure(self, url: str):
        """Record a failure and potentially open the circuit breaker."""
        import time
        agent = self.agents[url]
        agent.consecutive_failures += 1
        agent.last_failure = time.time()
        if agent.consecutive_failures >= 3:
            # Open circuit for 30 seconds
            agent.circuit_open_until = time.time() + 30
            agent.healthy = False

    def record_success(self, url: str):
        """Reset failure count on success."""
        agent = self.agents[url]
        agent.consecutive_failures = 0
        agent.healthy = True
        agent.circuit_open_until = 0

    async def delegate(self, url: str, text: str) -> dict | None:
        """Delegate to an agent with circuit breaker protection."""
        if not self.is_available(url):
            return None  # Skip unhealthy agents

        try:
            result = await send_with_retry(url, text, RetryConfig(max_retries=1))
            self.record_success(url)
            return result
        except Exception as e:
            self.record_failure(url)
            return None

    async def fan_out_resilient(
        self,
        urls: list[str],
        texts: list[str],
        min_results: int = 1,
    ) -> list[dict]:
        """Fan out to multiple agents, succeed if at least min_results return."""
        tasks = [self.delegate(url, text) for url, text in zip(urls, texts)]
        results = await asyncio.gather(*tasks)

        successful = [r for r in results if r is not None and "error" not in r]
        if len(successful) < min_results:
            raise RuntimeError(
                f"Only {len(successful)}/{len(urls)} agents responded. "
                f"Minimum required: {min_results}"
            )
        return successful
```

The circuit breaker pattern: after 3 consecutive failures, stop calling the agent for 30 seconds. This prevents a failing agent from slowing down the entire system with timeouts.

## Error propagation across agent chains

In multi-agent systems ([pipeline or hierarchical patterns](/blog/multi-agent-system-a2a)), errors propagate through the chain. Wrap errors with context at each level:

```python
# propagation.py

def wrap_downstream_error(
    downstream_agent: str,
    downstream_error: dict,
    current_agent: str,
) -> dict:
    """Wrap a downstream agent's error with context from the current agent."""
    return {
        "code": -32603,
        "message": f"Downstream agent '{downstream_agent}' failed",
        "data": {
            "currentAgent": current_agent,
            "downstreamAgent": downstream_agent,
            "downstreamError": downstream_error,
            "retryable": downstream_error.get("data", {}).get("retryable", False),
        },
    }


async def handle_with_propagation(
    request_id: str,
    text: str,
    downstream_url: str,
) -> dict:
    """Process a request and propagate downstream errors with context."""
    try:
        result = await send_with_retry(downstream_url, text)
        if "error" in result:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": wrap_downstream_error(
                    downstream_agent=downstream_url,
                    downstream_error=result["error"],
                    current_agent="coordinator",
                ),
            }
        return result
    except A2AError as e:
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": wrap_downstream_error(
                downstream_agent=downstream_url,
                downstream_error={
                    "code": e.code,
                    "message": e.message,
                    "data": e.data,
                },
                current_agent="coordinator",
            ),
        }
```

The resulting error response includes the full chain:

```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "error": {
    "code": -32603,
    "message": "Downstream agent 'http://code-agent:8002' failed",
    "data": {
      "currentAgent": "coordinator",
      "downstreamAgent": "http://code-agent:8002",
      "downstreamError": {
        "code": -32006,
        "message": "Task timed out",
        "data": { "retryable": true, "retryAfter": 10 }
      },
      "retryable": true
    }
  }
}
```

The client can see exactly where the failure happened and whether retrying makes sense.

## Checklist

- **Return proper JSON-RPC errors.** Do not return HTTP 500 with an HTML error page. Always return `{"jsonrpc": "2.0", "error": {...}}`.
- **Include `retryable` in error data.** Let clients make informed retry decisions.
- **Set layered timeouts.** Connection, read, and total. Never rely on a single timeout.
- **Implement circuit breakers** for multi-agent systems. A hung downstream agent should not consume your thread pool.
- **Log errors with request IDs.** Every error, every agent, every attempt. This is how you debug production failures.
- **Never expose internal details in errors.** Stack traces, file paths, environment variables -- keep them in server logs, not in error responses.
- **Test error paths.** Use the [testing patterns](/blog/a2a-agent-testing-debugging) to verify your agent handles bad input, timeouts, and downstream failures correctly.

## Further reading

- [Testing and Debugging A2A Agents](/blog/a2a-agent-testing-debugging) -- testing the error paths
- [Building Multi-Agent Systems](/blog/multi-agent-system-a2a) -- where error handling gets hard
- [A2A Authentication Guide](/blog/a2a-agent-authentication-guide) -- auth error codes and handling
- Browse agent implementations on [StackA2A](/agents)
