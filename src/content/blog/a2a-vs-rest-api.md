---
title: "A2A vs REST APIs: When Agents Beat Endpoints"
description: "Comparing A2A protocol with traditional REST APIs. When each makes sense, where A2A wins on discovery, streaming, and multi-turn, and where REST still dominates."
date: "2026-03-10"
readingTime: 7
tags: ["a2a", "rest", "comparison", "architecture"]
relatedStacks: []
---

Every A2A agent is an HTTP endpoint. So why not just build a REST API? You could define routes, accept JSON, return responses. It works. Teams have been building AI services this way since GPT-3.

The question isn't whether REST can do the job. It's whether you end up rebuilding half of A2A's features on top of it — and whether the result is interoperable with anything outside your own system.

## What REST gives you

REST is simple, universal, and battle-tested. Every language has HTTP clients. Every developer understands `POST /api/analyze`. Every ops team knows how to deploy, monitor, and scale REST services.

A typical AI service as REST:

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class AnalysisRequest(BaseModel):
    text: str
    depth: str = "standard"

class AnalysisResponse(BaseModel):
    summary: str
    key_findings: list[str]
    confidence: float

@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalysisRequest):
    result = await run_analysis(request.text, request.depth)
    return AnalysisResponse(
        summary=result.summary,
        key_findings=result.findings,
        confidence=result.confidence,
    )
```

Clean. Typed. Documented by OpenAPI automatically. Any HTTP client can call it.

## What REST doesn't give you

Build a few AI services as REST endpoints and you'll find yourself adding the same things every time.

### Discovery

REST has no standard for "what can this service do?" OpenAPI documents the API shape (routes, parameters, response schemas), but it doesn't describe capabilities in a way that another agent can reason about. You can't point an orchestrator at a REST service and have it figure out whether this service can handle a given task.

A2A agents publish [Agent Cards](/blog/a2a-agent-card-explained) — structured metadata with skills, descriptions, examples, and tags. An orchestrator reads the card, matches skills to the task, and routes accordingly. No human wiring required.

```bash
# A2A: machine-readable capability discovery
curl https://agent.example.com/.well-known/agent-card.json

# REST: you get API docs, not capability descriptions
curl https://api.example.com/openapi.json
```

The difference matters when you have 20 agents and need to route tasks dynamically. With REST, you maintain a hardcoded routing table. With A2A, agents discover each other.

### Streaming

REST supports streaming, but it's not standardized. You'll implement SSE or WebSockets differently for every service. Error handling, reconnection, partial update semantics — all custom.

A2A standardizes streaming through `message/stream`. Every A2A client knows how to handle `TaskStatusUpdateEvent` and `TaskArtifactUpdateEvent`. The `append`/`lastChunk` semantics for incremental output are defined in the spec, not reinvented per service.

```python
# REST: custom SSE implementation per service
@app.post("/api/analyze/stream")
async def analyze_stream(request: AnalysisRequest):
    async def generate():
        async for chunk in run_analysis_streaming(request.text):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")

# A2A: standardized streaming with defined event types
# Client code works with ANY A2A agent, not just this one
async for event in a2a_client.stream(task_id, message):
    if event.type == "status":
        print(f"State: {event.status.state}")
    elif event.type == "artifact":
        print(f"Output: {event.artifact.parts[0].text}")
```

### Multi-turn conversations

REST is stateless by design. If your AI service needs clarification, you either:

1. Return an error and make the client restructure their request
2. Build a session mechanism (cookies, tokens, database-backed state)
3. Require all context upfront in a single request

A2A has `input-required` built into the task lifecycle. The agent pauses, asks for clarification, and the client continues the same task. The task ID is the session. No additional infrastructure needed. See the [multi-turn guide](/blog/a2a-multi-turn-conversations) for the full pattern.

### Long-running tasks

A REST POST that takes 5 minutes will timeout. So you build a job queue: POST to submit, GET to poll status, maybe a webhook for completion. Every team builds this differently.

A2A has this built in. `tasks/get` for polling. Push notifications for webhooks. Streaming for real-time progress. Task states (`submitted`, `working`, `completed`, `failed`) are standardized.

## Side-by-side comparison

| Aspect | REST API | A2A Protocol |
|--------|----------|-------------|
| **Transport** | HTTP (any method) | HTTP + JSON-RPC + SSE |
| **Discovery** | OpenAPI (API shape) | Agent Cards (capabilities) |
| **Streaming** | Custom per service | Standardized SSE events |
| **Multi-turn** | Build it yourself | `input-required` state |
| **Long-running tasks** | Custom job queue | Built-in task lifecycle |
| **Auth** | Custom per service | Declared in Agent Card |
| **Interoperability** | Only within your system | Any A2A-compatible agent |
| **Tooling** | Massive ecosystem | Growing ecosystem |
| **Learning curve** | Minimal | Moderate |
| **Flexibility** | Total | Constrained to protocol |

## When REST wins

**Simple, fast operations.** If your service takes a prompt and returns a response in under a second, REST is simpler. You don't need task lifecycle management for a translation endpoint.

**Existing ecosystem.** REST has decades of tooling: API gateways, rate limiters, monitoring, client generation, testing frameworks. A2A tooling is catching up but isn't there yet.

**Non-agent consumers.** If your primary consumers are web frontends, mobile apps, or scripts — not other agents — REST is the natural choice. These consumers don't need agent discovery or multi-turn task management.

**Custom protocols.** REST lets you design exactly the API shape you need. A2A constrains you to JSON-RPC with a specific message format. If your use case doesn't fit the task/message/artifact model, REST gives you freedom.

**Internal services.** For microservices within a single system where you control both ends, REST (or gRPC) is simpler. A2A's discovery and interoperability benefits shine when crossing organizational or system boundaries.

## When A2A wins

**Agent-to-agent communication.** If another AI agent is calling your service, A2A is the right abstraction. The calling agent can discover capabilities, handle multi-turn clarification, and process streaming results — all through a standard protocol.

**Multi-agent systems.** When you have multiple agents that need to discover and delegate to each other dynamically, A2A's discovery mechanism eliminates hardcoded integrations. See [multi-agent stacks](/stacks) for production patterns.

**Tasks that take time.** Anything over 5 seconds benefits from A2A's task lifecycle. Status tracking, streaming progress, push notifications on completion — it's all there.

**Cross-organization interop.** A2A is an open standard. If you want external agents (from other teams, companies, or the open-source ecosystem) to consume your agent, A2A gives them a standard interface. A custom REST API requires custom integration for every consumer.

**Clarification-heavy workflows.** When the agent frequently needs to ask for more information, A2A's `input-required` pattern is cleaner than bolting sessions onto REST.

## Wrapping REST services as A2A agents

You don't have to choose. Wrap an existing REST service as an A2A agent:

```python
from a2a.server import A2AServer
import httpx

class RestWrapperAgent:
    """Wraps an existing REST API as an A2A agent."""

    def __init__(self, rest_base_url: str):
        self.rest_url = rest_base_url

    async def handle_task(self, context):
        user_text = context.current_message["parts"][0]["text"]

        # Parse the user's request and map to REST calls
        intent = await self.classify_intent(user_text)

        if intent == "analyze":
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.rest_url}/api/analyze",
                    json={"text": user_text, "depth": "detailed"},
                )
                result = response.json()

            await context.add_artifact(
                parts=[{
                    "kind": "text",
                    "text": f"## Analysis\n\n{result['summary']}\n\n"
                           f"### Key Findings\n"
                           + "\n".join(f"- {f}" for f in result["key_findings"]),
                }]
            )
            await context.set_status(state="completed")

        elif intent == "unclear":
            await context.set_status(
                state="input-required",
                message="I can analyze text or summarize documents. Which would you like?",
            )

server = A2AServer(agent=RestWrapperAgent("https://api.internal.example.com"))
```

This gives your existing REST service agent discovery, streaming, and multi-turn — without rewriting the underlying service.

## Decision framework

Ask these questions:

1. **Who is calling you?** Other agents --> A2A. Humans/apps --> REST (or both).
2. **How long do tasks take?** Sub-second --> REST. Seconds to minutes --> A2A.
3. **Do you need clarification?** Rarely --> REST. Often --> A2A.
4. **Cross-system interop?** Internal only --> REST. External consumers --> A2A.
5. **Multiple capabilities?** Single endpoint --> REST. Multiple discoverable skills --> A2A.

If you answered "A2A" to 3 or more, build an A2A agent. If you answered "REST" to 3 or more, stick with REST. If it's mixed, wrap your REST service with an A2A layer and get both.

The protocols aren't in competition. REST is a building block. A2A is a higher-level protocol for agent interoperability built on top of HTTP. Many production systems use REST internally and expose an A2A interface for agent-to-agent communication.

Browse the [agent directory](/agents) to see how production agents expose their capabilities, or read about how [A2A compares to gRPC](/blog/a2a-vs-grpc-comparison) for another perspective on protocol choice.
