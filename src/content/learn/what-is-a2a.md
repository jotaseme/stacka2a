---
title: "What Is the A2A Protocol?"
description: "The complete guide to Google's Agent-to-Agent protocol — what it is, why it exists, how it works, and when to use it."
readingTime: 15
order: 1
icon: "book"
---

## The Problem: AI Agents Can't Talk to Each Other

You built a research agent in Python with LangGraph. Your colleague built a code review agent in Java with Spring AI. Your company acquired a startup whose product runs on CrewAI. Now you need all three to work together on a single workflow.

Good luck. Every framework invented its own communication layer. LangGraph agents speak LangGraph. CrewAI agents speak CrewAI. There is no shared protocol, no discovery mechanism, no standard message format. You end up writing custom HTTP glue for every pair of agents that need to interact, and none of that glue is reusable. The integration code becomes more complex than the agents themselves.

This is not a new problem. We solved it for web services with REST. We solved it for RPCs with gRPC. We solved it for real-time communication with WebSockets. But for AI agents communicating with other AI agents? Until recently, there was nothing.

A2A fixes this.

## What A2A Is

A2A (Agent-to-Agent) is an open protocol that gives AI agents a standard way to discover each other, exchange messages, and delegate work. It does not care what framework you used, what language you wrote the agent in, or what LLM powers it. If your agent can serve HTTP, it can speak A2A.

The protocol is built on standards you already know: HTTP for transport, JSON-RPC 2.0 for message framing, Server-Sent Events for streaming, and webhooks for push notifications. There is nothing exotic here. An A2A agent is an HTTP server that implements a specific set of JSON-RPC methods and publishes a JSON metadata file describing what it can do.

The key design decisions that matter:

- **Opaque agents.** A2A treats agents as black boxes. The caller sends a task; the agent decides how to complete it. No exposing internal tools, memory, or reasoning chains. This is delegation, not remote procedure calling.
- **Built-in discovery.** Every agent publishes a machine-readable Agent Card at a well-known URL. Any client can fetch it to understand the agent's capabilities before sending work.
- **Multi-turn by default.** Agents can pause mid-task to ask for clarification. The protocol models this as a first-class state transition, not a hack.
- **Streaming native.** Real-time partial results via SSE are part of the spec, not an afterthought.

A2A is not a framework. It does not tell you how to build an agent. It tells you how agents talk to each other, regardless of how they were built.

## Brief History

Google announced A2A in April 2025 with backing from over 50 technology companies. The initial release included a protocol specification, reference implementations, and SDKs for Python and JavaScript.

In June 2025, Google donated A2A to the Linux Foundation. The foundation launched the Agent2Agent Protocol Project with founding members including Amazon Web Services, Cisco, Microsoft, Salesforce, SAP, and ServiceNow. The specification, SDKs, and developer tooling all moved under the Linux Foundation's governance.

As of early 2026, A2A has reached version 0.3.0 of the specification. More than 100 companies have validated or integrated the protocol. Official SDKs exist for Python, JavaScript/TypeScript, Java, Go, and C#. The protocol added gRPC support, Agent Card signing, and extended client-side capabilities. It is licensed under Apache 2.0.

The governance shift to the Linux Foundation matters because it means no single company controls the protocol's direction. A2A is a genuine open standard, not a corporate project with an open-source license.

## Core Concepts

Five things define A2A: Agent Cards, JSON-RPC methods, tasks, messages with parts, and artifacts. Understand these and you understand the protocol.

### Agent Cards

Every A2A agent publishes a JSON document at `/.well-known/agent-card.json`. This is the agent's machine-readable resume. It describes who the agent is, what it can do, what formats it accepts, and how to authenticate.

```json
{
  "name": "Code Review Agent",
  "description": "Analyzes code for bugs, security vulnerabilities, and style issues.",
  "version": "2.1.0",
  "url": "https://code-review.example.com/a2a",
  "provider": {
    "organization": "DevTools Inc.",
    "url": "https://devtools.example.com"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": false
  },
  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/plain", "application/json"],
  "skills": [
    {
      "id": "code-review",
      "name": "Code Review",
      "description": "Reviews code for bugs, security issues, and style violations. Supports Python, JavaScript, TypeScript, Go, and Java.",
      "tags": ["code", "review", "security"],
      "examples": [
        "Review this Python function for security issues",
        "Check this TypeScript module for bugs"
      ],
      "inputModes": ["text/plain"],
      "outputModes": ["text/plain", "application/json"]
    }
  ],
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  },
  "security": [{ "bearer": [] }]
}
```

The `skills` array is the most important part. Each skill has an `id`, a human-readable `name`, a `description` that orchestrators use to decide whether to route tasks to this agent, `tags` for categorization, and `examples` showing valid inputs. LLM-based orchestrators rely heavily on the description and examples to make routing decisions, so write them carefully.

The `capabilities` object declares what the agent actually supports. If you set `streaming: true`, you had better handle `SendStreamingMessage`. If you set `pushNotifications: true`, you need to implement the push notification configuration endpoints. Do not lie here -- clients will trust your declarations and fail when reality does not match.

Authentication follows the OpenAPI pattern. The `securitySchemes` object defines available auth methods (API key, Bearer, OAuth2, OpenID Connect, mutual TLS), and the top-level `security` array sets the default requirement. Individual skills can override the default.

For a deep dive into Agent Card structure, see our [Agent Card specification guide](/learn/agent-card-spec).

### JSON-RPC Methods

A2A communication uses JSON-RPC 2.0 over HTTP. The protocol defines these core methods:

| Method | Purpose |
|---|---|
| `message/send` | Send a message, get a complete response |
| `message/stream` | Send a message, stream the response via SSE |
| `tasks/get` | Check the current state of a task |
| `tasks/cancel` | Cancel a running task |
| `tasks/pushNotificationConfig/set` | Register a webhook for task updates |
| `tasks/pushNotificationConfig/get` | Retrieve push notification configuration |
| `tasks/pushNotificationConfig/list` | List all push configurations for a task |
| `tasks/pushNotificationConfig/delete` | Remove a push notification configuration |

The two methods you will use most are `message/send` and `message/stream`. Here is a basic `message/send` request:

```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "id": "req-1",
  "params": {
    "message": {
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "Review this function for security issues:\n\ndef login(username, password):\n    query = f\"SELECT * FROM users WHERE name='{username}' AND pass='{password}'\"\n    return db.execute(query)"
        }
      ]
    }
  }
}
```

The response comes back as a JSON-RPC result containing either a `Task` object (when the agent creates a task to track the work) or a `Message` object (for simple request/response interactions).

### Messages and Parts

Messages are the atoms of A2A communication. Every message has a `role` (either `"user"` for the caller or `"agent"` for the responder) and an array of `parts`. Parts can be:

- **`text`** -- plain text content
- **`file`** -- file references with media type, either inline (base64) or by URI
- **`data`** -- structured JSON data

This multi-part design means an agent can return a text explanation alongside a JSON report alongside a generated image, all in a single message. It is far more flexible than protocols that only support text.

### Tasks

A Task is the fundamental unit of tracked work in A2A. When an agent receives a message and needs to do non-trivial processing, it creates a task with a unique ID and returns it to the client. The task progresses through a defined lifecycle (more on that below) and accumulates artifacts as the agent works.

Tasks have:

- A unique `id` generated by the agent
- A `contextId` that groups related tasks into a conversation
- A `status` with a `state` field tracking lifecycle position
- An `artifacts` array containing the agent's output
- An optional `history` of all messages exchanged

The `contextId` is what enables multi-turn conversations. The agent generates one when processing a message that does not include one. Subsequent messages that include the same `contextId` are treated as part of the same conversation, and the agent can maintain state across them.

### Artifacts

Artifacts are the output of an agent's work. When an agent completes a task (or makes progress on one), it produces artifacts. Each artifact has an `id`, an optional `mediaType`, and an array of `parts` (the same text/file/data parts used in messages).

A code review agent might produce two artifacts: a text artifact with the human-readable review and a JSON artifact with structured findings. A report generation agent might produce a PDF file artifact. The protocol does not constrain what artifacts contain -- it just provides the envelope.

## The Discovery Flow

Discovery in A2A follows a predictable four-step sequence. No service registry, no DNS tricks, no configuration file.

**Step 1: Fetch the Agent Card.** The client knows the agent's base URL (from configuration, a registry, or word of mouth) and sends a GET request to `/.well-known/agent-card.json`.

```bash
curl https://code-review.example.com/.well-known/agent-card.json
```

**Step 2: Evaluate skills.** The client parses the card and examines the skills array. An LLM-based orchestrator might compare the skill descriptions and examples against the current task to decide if this agent is a good fit. A simpler client might match on tags.

```python
import httpx

async def discover_and_match(base_url: str, task_description: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{base_url}/.well-known/agent-card.json")
        card = resp.json()

    for skill in card.get("skills", []):
        # Simple keyword matching; production systems use LLM-based matching
        if any(tag in task_description.lower() for tag in skill.get("tags", [])):
            return card

    return None
```

**Step 3: Authenticate.** If the card declares security requirements, the client obtains credentials (API key, OAuth2 token, etc.) before proceeding.

**Step 4: Send the task.** The client sends a `message/send` or `message/stream` request to the `url` specified in the card.

For agents with sensitive capabilities, A2A supports an extended Agent Card pattern. The public card at the well-known URL contains basic information. When `supportsAuthenticatedExtendedCard` is `true`, authenticated requests to a separate endpoint return additional private skills that should not be publicly visible.

Browse real Agent Cards from production agents in our [agent directory](/agents).

## Task Lifecycle

Every task in A2A progresses through a defined set of states. Understanding this lifecycle is essential for building robust clients.

```
                    +--------------+
                    |  submitted   |
                    +------+-------+
                           |
                    +------v-------+
               +---+|   working    |<---+
               |    +------+-------+    |
               |           |            |
               |    +------v-------+    |
               |    |input-required+----+
               |    +------+-------+
               |           |
        +------+---+-------+--------+
        |          |       |        |
   +----v---+ +---v--+ +--v----+ +-v--------+
   |canceled| |failed| |rejected| |completed|
   +--------+ +------+ +--------+ +---------+
```

**Active states:**

- **`submitted`** -- the task has been received but processing has not started. This is the initial state.
- **`working`** -- the agent is actively processing the task. It may be calling tools, reasoning, or delegating to sub-agents.
- **`input-required`** -- the agent needs more information from the client to continue. This is the state that enables multi-turn conversations.

**Terminal states:**

- **`completed`** -- the task finished successfully. Artifacts are available.
- **`failed`** -- the task encountered an error. The status will include an error message.
- **`canceled`** -- the client requested cancellation via `tasks/cancel`.
- **`rejected`** -- the agent declined to process the task (e.g., it does not match any skill, or the client lacks permission).

Once a task reaches a terminal state, it cannot be restarted. The client must create a new task if it wants to retry.

The `input-required` state deserves special attention. When an agent transitions to this state, it includes a message explaining what it needs. The client responds by sending a new message with the same `taskId`, and the agent resumes processing. This back-and-forth can repeat multiple times within a single task.

## Streaming with SSE

For tasks that take time, waiting for a complete response is a poor user experience. A2A supports real-time streaming via Server-Sent Events.

Instead of `message/send`, the client calls `message/stream`. The response is an SSE stream that delivers events as the agent works:

```python
import httpx
import json

async def stream_task(agent_url: str, message_text: str):
    payload = {
        "jsonrpc": "2.0",
        "method": "message/stream",
        "id": "req-stream-1",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"kind": "text", "text": message_text}]
            }
        }
    }

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            agent_url,
            json=payload,
            headers={"Accept": "text/event-stream"}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    # event contains statusUpdate, artifactUpdate, or complete task
                    print(json.dumps(event, indent=2))
```

The stream delivers several event types:

- **`TaskStatusUpdateEvent`** -- the task changed state (e.g., from `submitted` to `working`). Includes a timestamp and the new status.
- **`TaskArtifactUpdateEvent`** -- new artifact content is available. For text artifacts, this streams incrementally as the agent generates content.
- **`Task`** -- the final, complete task object. This is the last event in the stream.

The specification guarantees event ordering: events are delivered in the order they were generated and must not be reordered during transmission.

There is also `tasks/resubscribe`, which lets a client reconnect to an existing task's stream if the connection drops. This is critical for production systems where network interruptions are inevitable.

In TypeScript, streaming looks like this:

```typescript
const response = await fetch(agentUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "message/stream",
    id: "req-stream-1",
    params: {
      message: {
        role: "user",
        parts: [{ kind: "text", text: "Analyze this codebase" }],
      },
    },
  }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const event = JSON.parse(line.slice(6));
      console.log("Event:", event);
    }
  }
}
```

An agent declares streaming support in its Agent Card via `capabilities.streaming: true`. Always check this before attempting to stream. If the agent does not support streaming, use `message/send` and poll with `tasks/get` for long-running tasks.

## Polling as a Fallback

Not every agent supports streaming. For agents that do not, or for situations where you need to check on a task later, A2A provides `tasks/get`:

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/get",
  "id": "req-poll-1",
  "params": {
    "id": "task-abc123"
  }
}
```

The response includes the task's current state, any artifacts produced so far, and optionally the full message history. Poll at reasonable intervals -- every few seconds for fast tasks, every 30-60 seconds for long-running ones.

## Push Notifications for Long-Running Tasks

Some tasks take minutes or hours. Polling is wasteful. Streaming ties up a connection. Push notifications solve this: the client registers a webhook URL, and the agent sends HTTP POST requests to that URL when the task state changes.

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/pushNotificationConfig/set",
  "id": "req-push-1",
  "params": {
    "taskId": "task-abc123",
    "pushNotificationConfig": {
      "url": "https://my-app.example.com/webhooks/a2a",
      "authentication": {
        "schemes": ["bearer"],
        "credentials": "webhook-secret-token"
      }
    }
  }
}
```

Once configured, the agent sends push notifications as HTTP POST requests to the registered URL. The payload contains the same `TaskStatusUpdateEvent` and `TaskArtifactUpdateEvent` objects you would receive via streaming. The client must respond with an HTTP 2xx status to acknowledge receipt.

Push notifications support authentication so the client can verify that incoming webhooks are genuine. You can configure multiple webhooks per task, filter by event type, and delete configurations when they are no longer needed.

An agent declares push notification support via `capabilities.pushNotifications: true` in its Agent Card.

## Multi-Turn Conversations

Multi-turn is not a special mode in A2A. It is how the protocol works by default. Two identifiers make it possible: `contextId` and `taskId`.

The `contextId` groups related interactions into a logical conversation. When you send a message without a `contextId`, the agent generates one and returns it in the response. Include that `contextId` in subsequent messages, and the agent treats them as part of the same conversation.

The `taskId` identifies a specific unit of work. When the agent transitions a task to `input-required`, you continue it by sending a new message with the same `taskId`.

Here is a multi-turn flow in practice:

```python
import httpx
import json

AGENT_URL = "https://travel-agent.example.com/a2a"

async def multi_turn_conversation():
    async with httpx.AsyncClient() as client:
        # Turn 1: Initial request
        resp = await client.post(AGENT_URL, json={
            "jsonrpc": "2.0",
            "method": "message/send",
            "id": "turn-1",
            "params": {
                "message": {
                    "role": "user",
                    "parts": [{"kind": "text", "text": "Book me a flight to Tokyo next week"}]
                }
            }
        })
        result = resp.json()["result"]

        # The agent needs more info -- state is "input-required"
        task_id = result["id"]
        context_id = result["contextId"]
        # Agent message: "What dates specifically? And which airport are you flying from?"

        # Turn 2: Provide clarification
        resp = await client.post(AGENT_URL, json={
            "jsonrpc": "2.0",
            "method": "message/send",
            "id": "turn-2",
            "params": {
                "message": {
                    "role": "user",
                    "parts": [{"kind": "text", "text": "March 15-22, departing from SFO"}],
                    "taskId": task_id,
                    "contextId": context_id,
                }
            }
        })
        result = resp.json()["result"]

        # Agent responds with options -- might need another turn
        # state could be "input-required" again or "completed"
        if result["status"]["state"] == "input-required":
            # Turn 3: Make a selection
            resp = await client.post(AGENT_URL, json={
                "jsonrpc": "2.0",
                "method": "message/send",
                "id": "turn-3",
                "params": {
                    "message": {
                        "role": "user",
                        "parts": [{"kind": "text", "text": "Option 2, the direct flight"}],
                        "taskId": task_id,
                        "contextId": context_id,
                    }
                }
            })
            result = resp.json()["result"]
            # state: "completed", artifacts contain booking confirmation
```

The protocol enforces consistency: if you include both a `taskId` and a `contextId`, and they do not match (the task belongs to a different context), the agent must reject the request with an error. This prevents accidental cross-contamination between conversations.

## When to Use A2A vs MCP vs Direct API Calls

This is the question everyone asks. Here is a direct answer.

**Use A2A when you are delegating to an autonomous agent.** The receiving agent decides how to complete the task. It might use its own tools, call sub-agents, break the task into steps, or ask for clarification. You are saying "handle this," not "call this function with these arguments." Examples: a research agent, a code review agent, a data analysis agent.

**Use MCP when you want to give an LLM access to tools.** MCP (Model Context Protocol, by Anthropic) is for tool access. The LLM stays in control -- it picks which tool to call, constructs the arguments, and processes the result. The tool server is a dumb function executor. Examples: reading a file, querying a database, calling a third-party API.

**Use direct API calls when there is no agent on the other end.** If you are calling a REST API, a database, or a cloud service, you do not need A2A or MCP. Those are services, not agents. Use the appropriate client library.

The difference boils down to control. With MCP, the LLM orchestrates. With A2A, the agent you delegate to orchestrates. With direct API calls, your code orchestrates.

A useful heuristic: if you would describe the integration as "calling a function," use MCP. If you would describe it as "asking someone to handle something," use A2A.

| | A2A | MCP | Direct API |
|---|---|---|---|
| **Control model** | Remote agent decides | LLM decides | Your code decides |
| **Discovery** | Agent Cards | Manual configuration | API docs |
| **Transport** | HTTP + SSE | stdio + HTTP | Varies |
| **State** | Multi-turn conversations | Stateless tool calls | You manage it |
| **Streaming** | Native SSE | Per-tool | Varies |
| **Auth** | Defined in spec (OpenAPI-style) | Implementation-dependent | Varies |

Most production systems end up using both A2A and MCP. A common pattern is an MCP server that acts as a gateway to A2A agents -- the LLM calls an MCP tool, and that tool delegates to an A2A agent behind the scenes. The LLM gets tool-like simplicity; the A2A agent gets full autonomy. For a detailed comparison, read our [A2A vs MCP analysis](/blog/a2a-vs-mcp-comparison).

## The Ecosystem

### SDKs

Official SDKs maintained under the Linux Foundation's A2A project:

| Language | Package | Install |
|---|---|---|
| Python | `a2a-sdk` | `pip install a2a-sdk` |
| JavaScript/TypeScript | `@a2a-js/sdk` | `npm install @a2a-js/sdk` |
| Java | `a2a-java` | Maven/Gradle |
| Go | `a2a-go` | `go get` |
| C# / .NET | `a2a-dotnet` | NuGet |

All SDKs implement the A2A Protocol Specification v0.3.0 and provide both client and server implementations. The Python and JavaScript SDKs are the most mature, with the others quickly catching up.

The Python SDK supports JSON-RPC, HTTP+JSON/REST, and gRPC transports. It integrates with FastAPI and Starlette for server-side implementations, and includes an `InMemoryTaskStore` for development and PostgreSQL/MySQL/SQLite adapters for production.

### Frameworks with Native A2A Support

Several major agent frameworks have built-in A2A support:

**Google ADK (Agent Development Kit)** -- the most streamlined option. A single `to_a2a()` call wraps any ADK agent into a full A2A server with auto-generated Agent Card, JSON-RPC endpoints, and SSE streaming. See the [Google ADK stack](/stacks) for pre-built examples.

**LangGraph** -- every LangGraph assistant automatically gets an A2A endpoint at `/a2a/{assistant_id}` when running on the LangGraph Platform. Zero configuration required. Agent Cards are auto-generated from assistant metadata.

**CrewAI** -- supports A2A through its enterprise platform, allowing CrewAI crews to be exposed as A2A agents and to consume external A2A agents as part of multi-agent workflows.

**Semantic Kernel (Microsoft)** -- the .NET and Python versions support A2A for agent-to-agent communication within the Microsoft ecosystem, with integration into Azure AI Agent Service.

**IBM ACP / Bee Agent Framework** -- IBM's agent framework integrates A2A for enterprise agent orchestration.

**Quarkus (Java)** -- the Quarkus framework has native A2A support for building Java-based A2A agents with reactive streams.

Browse production-ready framework combinations in our [stacks directory](/stacks).

### The Broader Ecosystem

The A2A samples repository (`a2aproject/a2a-samples`) contains reference implementations across languages:

- **Helloworld** -- minimal agents in Python, JavaScript, Java, Go, and C#
- **Multi-agent orchestration** -- agents that delegate to other agents
- **MCP bridge** -- agents accessible via both A2A and MCP
- **Security samples** -- OAuth2, mutual TLS, message signing
- **Framework integrations** -- ADK, LangGraph, CrewAI, Spring Boot

## Getting Started: Your First A2A Agent in Python

Here is the simplest possible A2A agent. It receives a message and echoes it back. No LLM, no tools, just the protocol skeleton.

Install the SDK:

```bash
pip install "a2a-sdk[http-server]"
```

Create `agent.py`:

```python
import uvicorn
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.server.agent_execution import AgentExecutor, RequestContext, EventQueue
from a2a.utils import new_agent_text_message
from a2a.types import AgentCard, AgentSkill, AgentCapabilities


class EchoExecutor(AgentExecutor):
    """Echoes back whatever the user sends."""

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        # Extract the user's text from the incoming message
        user_text = context.message.parts[0].text
        await event_queue.enqueue_event(
            new_agent_text_message(f"Echo: {user_text}")
        )

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        raise Exception("cancel not supported")


# Define the agent's identity and capabilities
agent_card = AgentCard(
    name="Echo Agent",
    description="Echoes back any message it receives",
    url="http://localhost:9999/",
    version="1.0.0",
    default_input_modes=["text"],
    default_output_modes=["text"],
    capabilities=AgentCapabilities(streaming=True),
    skills=[
        AgentSkill(
            id="echo",
            name="Echo",
            description="Repeats your message back to you",
            tags=["echo", "test"],
            examples=["Hello!", "Say this back to me"],
        )
    ],
)

# Wire up the server
request_handler = DefaultRequestHandler(
    agent_executor=EchoExecutor(),
    task_store=InMemoryTaskStore(),
)

app = A2AStarletteApplication(
    agent_card=agent_card,
    http_handler=request_handler,
)

if __name__ == "__main__":
    uvicorn.run(app.build(), host="0.0.0.0", port=9999)
```

Run it:

```bash
python agent.py
```

Verify the Agent Card:

```bash
curl -s http://localhost:9999/.well-known/agent-card.json | python -m json.tool
```

Send a message:

```bash
curl -X POST http://localhost:9999/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "Hello from A2A!"}]
      }
    }
  }'
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": "test-1",
  "result": {
    "id": "task-generated-id",
    "contextId": "ctx-generated-id",
    "status": { "state": "completed" },
    "artifacts": [
      {
        "parts": [{ "kind": "text", "text": "Echo: Hello from A2A!" }]
      }
    ]
  }
}
```

That is a working A2A agent. It publishes an Agent Card, accepts JSON-RPC requests, creates tasks, and returns artifacts. Everything a client needs to discover it, evaluate it, and interact with it is built in.

## A Real Agent: Adding LLM-Powered Logic

The echo agent proves the protocol works. Here is a more realistic agent that uses Google's ADK to power actual reasoning:

```python
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

agent = Agent(
    model="gemini-2.0-flash",
    name="research_assistant",
    description="Summarizes topics and answers research questions with structured analysis.",
    instruction="""You are a research assistant. When given a topic:
1. Provide a clear, structured answer
2. Include relevant facts and context
3. Use markdown formatting for readability
Keep responses concise -- 200-400 words unless more detail is requested.""",
)

# One line to expose the agent over A2A
a2a_app = to_a2a(agent, port=8001)
```

```bash
uvicorn agent:a2a_app --host localhost --port 8001
```

The `to_a2a()` function handles everything: Agent Card generation from agent metadata, JSON-RPC endpoint creation, SSE streaming support, and serving the card at `/.well-known/agent-card.json`. Zero protocol boilerplate.

## Consuming an A2A Agent from TypeScript

You do not need to build agents to use A2A. Here is a TypeScript client that discovers an agent, evaluates its skills, and sends it a task:

```typescript
import { A2AClient } from "@a2a-js/sdk";

async function main() {
  // Step 1: Discover the agent
  const client = new A2AClient({
    agentCardUrl: "http://localhost:9999/.well-known/agent-card.json",
  });

  const card = await client.getAgentCard();
  console.log(`Agent: ${card.name}`);
  console.log(`Skills: ${card.skills.map((s) => s.name).join(", ")}`);

  // Step 2: Send a task
  const response = await client.sendMessage({
    message: {
      role: "user",
      parts: [{ kind: "text", text: "What are the key features of Rust?" }],
    },
  });

  // Step 3: Process the response
  if ("artifacts" in response) {
    for (const artifact of response.artifacts) {
      for (const part of artifact.parts) {
        if (part.kind === "text") {
          console.log(part.text);
        }
      }
    }
  }
}

main().catch(console.error);
```

And a streaming client:

```typescript
const stream = await client.sendStreamingMessage({
  message: {
    role: "user",
    parts: [{ kind: "text", text: "Explain WebAssembly in detail" }],
  },
});

for await (const event of stream) {
  if (event.artifactUpdate) {
    // Print text as it streams in
    for (const part of event.artifactUpdate.artifact.parts) {
      if (part.kind === "text") {
        process.stdout.write(part.text);
      }
    }
  }
}
```

## Agent-to-Agent: The Full Loop

The real power of A2A is agents talking to other agents. Here is the pattern using Google ADK, where a coordinator agent delegates to a remote research agent:

```python
from google.adk import Agent
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent

# Connect to an existing A2A agent
remote_research = RemoteA2aAgent(
    name="remote_research",
    description="Remote research assistant available via A2A",
    agent_card_url="http://localhost:8001/.well-known/agent-card.json",
)

# Create a coordinator that uses the remote agent
coordinator = Agent(
    model="gemini-2.0-flash",
    name="coordinator",
    description="Coordinates tasks across multiple specialist agents.",
    instruction="When users ask research questions, delegate to remote_research.",
    sub_agents=[remote_research],
)
```

The coordinator does not know or care how the research agent is implemented. It discovers the agent via its Agent Card, evaluates its skills, and delegates work over A2A. The research agent could be running Python, Java, Go, or anything else. It could switch frameworks tomorrow. The coordinator would not notice.

This is the promise of A2A: build agents in whatever language and framework makes sense for each problem, and let them work together through a standard protocol.

## Security Considerations

A2A agents are HTTP services. An unprotected agent is an open API, and Agent Cards make the URL discoverable. Security is not optional.

At minimum:

- **Authenticate every request.** Use OAuth2 client credentials for agent-to-agent communication. Declare your auth requirements in the Agent Card so clients know how to authenticate before sending a request.
- **Use short-lived tokens.** 15-30 minutes for machine-to-machine communication. Implement token refresh in your client.
- **Scope permissions granularly.** Per-skill scopes like `review:read` and `review:execute`, not a single "access everything" scope.
- **Validate on the agent side.** Never trust that a gateway has validated the token. Your agent validates independently.
- **Use TLS everywhere.** A2A communication must occur over HTTPS in production.
- **Rate-limit the Agent Card endpoint.** It is public. An attacker mapping your capabilities can craft targeted attacks.

The A2A specification supports API keys, Bearer tokens, OAuth2 (all flows), OpenID Connect, and mutual TLS. Choose based on your deployment model. For a detailed walkthrough, see the security samples in the `a2a-samples` repository.

## What Comes Next

A2A is still evolving. Version 0.3.0 added gRPC support, Agent Card signing for cryptographic verification, and extended client-side capabilities. The specification is heading toward a 1.0 release under Linux Foundation governance.

The trajectory is clear: A2A is becoming the HTTP of AI agents. Just as REST gave web services a common language, A2A gives agents a common language. The protocol is simple enough to implement in an afternoon and powerful enough to support enterprise multi-agent systems.

Start by browsing the [agent directory](/agents) to see what is already available. Pick a [stack](/stacks) that matches your framework. Read the [Agent Card spec](/learn/agent-card-spec) to understand discovery in depth. And build something -- the barrier to entry is a Python file and twenty minutes.
