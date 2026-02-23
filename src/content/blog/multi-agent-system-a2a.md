---
title: "Building Multi-Agent Systems with A2A"
description: "Architecture patterns for multi-agent A2A systems: coordinator, pipeline, fan-out/fan-in, and hierarchical delegation. Working code for each pattern."
date: "2026-03-16"
readingTime: 11
tags: ["a2a", "multi-agent", "architecture", "tutorial"]
relatedStacks: ["multi-agent"]
relatedAgents: []
---

Single agents are useful. Multiple agents working together are transformative. The A2A protocol was built for this -- agent-to-agent communication over HTTP, with discovery, streaming, and structured task delegation baked in.

This post covers four architecture patterns for multi-agent systems, each with working code. Pick the one that matches your problem.

## The four patterns

| Pattern | When to use | Complexity |
|---------|-------------|------------|
| Coordinator | One agent routes tasks to specialists | Low |
| Pipeline | Sequential processing stages | Low |
| Fan-out/fan-in | Parallel processing with aggregation | Medium |
| Hierarchical | Nested delegation with sub-coordinators | High |

All four share the same foundation: agents discover each other via [Agent Cards](/blog/a2a-agent-card-explained), communicate over JSON-RPC, and exchange structured tasks.

## Shared infrastructure

Every pattern needs an A2A client. Here is a reusable one:

```python
# a2a_client.py
import httpx
import uuid
from dataclasses import dataclass


@dataclass
class AgentEndpoint:
    name: str
    url: str
    skills: list[str]


async def discover_agent(base_url: str) -> AgentEndpoint:
    """Fetch an agent's card and extract key metadata."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{base_url}/.well-known/agent-card.json")
        resp.raise_for_status()
        card = resp.json()
    return AgentEndpoint(
        name=card["name"],
        url=card["url"],
        skills=[s["id"] for s in card.get("skills", [])],
    )


async def send_task(agent_url: str, text: str, context_id: str | None = None) -> dict:
    """Send a message/send request to an A2A agent."""
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
    if context_id:
        payload["params"]["message"]["contextId"] = context_id

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(agent_url, json=payload)
        resp.raise_for_status()
        return resp.json()


def extract_text(response: dict) -> str:
    """Pull the text content from an A2A response."""
    result = response.get("result", {})
    artifacts = result.get("artifacts", [])
    parts = []
    for artifact in artifacts:
        for part in artifact.get("parts", []):
            if part.get("type") == "text":
                parts.append(part["text"])
    return "\n".join(parts)
```

This handles discovery, task sending, and response parsing. Every pattern below uses these functions.

## Pattern 1: Coordinator

One agent receives all requests and routes them to the right specialist. This is the most common pattern and the one you should start with.

```
              +--------------+
              |  Coordinator |
              +------+-------+
                     |
           +---------+---------+
           |         |         |
           v         v         v
      +--------+ +--------+ +--------+
      |Research| |  Code  | |Writing |
      | Agent  | | Agent  | | Agent  |
      +--------+ +--------+ +--------+
```

The coordinator inspects the incoming request, matches it against available agent skills, and delegates.

```python
# coordinator.py
import asyncio
from google.adk import Agent
from a2a_client import discover_agent, send_task, extract_text

SPECIALIST_URLS = [
    "http://localhost:8001",  # Research agent
    "http://localhost:8002",  # Code agent
    "http://localhost:8003",  # Writing agent
]


class CoordinatorAgent:
    def __init__(self):
        self.specialists = []

    async def discover_specialists(self):
        """Discover all specialist agents on startup."""
        for url in SPECIALIST_URLS:
            try:
                agent = await discover_agent(url)
                self.specialists.append(agent)
                print(f"Discovered: {agent.name} with skills {agent.skills}")
            except Exception as e:
                print(f"Failed to discover agent at {url}: {e}")

    def match_specialist(self, task_description: str) -> AgentEndpoint | None:
        """Simple keyword matching. In production, use an LLM for routing."""
        task_lower = task_description.lower()
        keyword_map = {
            "research": ["research", "summarize", "analyze", "find"],
            "code": ["code", "implement", "debug", "refactor", "function"],
            "writing": ["write", "draft", "blog", "email", "document"],
        }
        for specialist in self.specialists:
            for skill in specialist.skills:
                keywords = keyword_map.get(skill, [])
                if any(kw in task_lower for kw in keywords):
                    return specialist
        return None

    async def handle_request(self, user_message: str) -> str:
        specialist = self.match_specialist(user_message)
        if not specialist:
            return "No specialist agent available for this task."

        response = await send_task(specialist.url, user_message)
        return extract_text(response)
```

For production, replace `match_specialist` with an LLM call. Feed it the skill descriptions from each Agent Card and let it pick:

```python
async def match_specialist_llm(self, task: str) -> AgentEndpoint | None:
    """Use an LLM to route tasks to the right specialist."""
    skill_descriptions = "\n".join(
        f"- {a.name}: skills={a.skills}" for a in self.specialists
    )
    prompt = f"""Given these available agents:
{skill_descriptions}

Which agent should handle this task: "{task}"
Reply with just the agent name, or "none" if no agent fits."""

    # Use your preferred LLM here
    from google.adk import Agent
    router = Agent(model="gemini-2.0-flash", name="router", instruction=prompt)
    # Parse LLM response to find matching agent name
    # ...
```

## Pattern 2: Pipeline

Tasks flow through a sequence of agents, each transforming the output before passing it to the next. Good for workflows like: research -> analyze -> write report.

```
+----------+     +----------+     +----------+     +----------+
| Collect  | --> | Analyze  | --> |  Format  | --> |  Review  |
|   Data   |     |   Data   |     |  Report  |     |  Output  |
+----------+     +----------+     +----------+     +----------+
```

```python
# pipeline.py
import asyncio
from a2a_client import send_task, extract_text


class AgentPipeline:
    def __init__(self, stages: list[dict]):
        """
        stages: list of {"url": "http://...", "prompt_template": "..."}
        Each stage's prompt_template should contain {input} placeholder.
        """
        self.stages = stages

    async def run(self, initial_input: str) -> str:
        current_output = initial_input

        for i, stage in enumerate(self.stages):
            prompt = stage["prompt_template"].format(input=current_output)
            print(f"Stage {i + 1}: Sending to {stage['url']}")

            response = await send_task(stage["url"], prompt)
            current_output = extract_text(response)

            if not current_output:
                raise RuntimeError(f"Stage {i + 1} returned empty output")

            print(f"Stage {i + 1} complete. Output length: {len(current_output)}")

        return current_output


# Usage
async def main():
    pipeline = AgentPipeline([
        {
            "url": "http://localhost:8001",
            "prompt_template": "Research this topic and provide key facts: {input}",
        },
        {
            "url": "http://localhost:8002",
            "prompt_template": "Analyze these research findings and identify insights:\n{input}",
        },
        {
            "url": "http://localhost:8003",
            "prompt_template": "Write a professional report based on this analysis:\n{input}",
        },
    ])

    result = await pipeline.run("Impact of remote work on software team productivity")
    print(result)

asyncio.run(main())
```

Pipeline strengths: simple mental model, easy to debug (check each stage's output), easy to swap out individual agents.

Pipeline weakness: total latency is the sum of all stages. If stage 2 takes 30 seconds, the whole pipeline waits.

## Pattern 3: Fan-out/fan-in

Send the same task (or sub-tasks) to multiple agents in parallel, then aggregate the results. Good for when you need multiple perspectives or can decompose work into independent chunks.

```
              +--------------+
              |  Dispatcher  |
              +------+-------+
                     |
           +---------+---------+
           |         |         |
           v         v         v
      +--------+ +--------+ +--------+
      |Agent A | |Agent B | |Agent C |
      +---+----+ +---+----+ +---+----+
          |          |          |
          +----------+----------+
                     |
                     v
              +--------------+
              |  Aggregator  |
              +--------------+
```

```python
# fan_out.py
import asyncio
from a2a_client import send_task, extract_text


async def fan_out_fan_in(
    agent_urls: list[str],
    prompts: list[str],
    aggregator_url: str,
) -> str:
    """
    Send tasks to multiple agents in parallel, then aggregate results.
    agent_urls and prompts must be the same length.
    """
    assert len(agent_urls) == len(prompts)

    # Fan-out: send all tasks concurrently
    tasks = [
        send_task(url, prompt)
        for url, prompt in zip(agent_urls, prompts)
    ]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    # Collect results, skip failures
    results = []
    for i, resp in enumerate(responses):
        if isinstance(resp, Exception):
            print(f"Agent {agent_urls[i]} failed: {resp}")
            continue
        text = extract_text(resp)
        if text:
            results.append(f"[Source: Agent {i + 1}]\n{text}")

    if not results:
        raise RuntimeError("All agents failed")

    # Fan-in: aggregate results
    combined = "\n\n---\n\n".join(results)
    aggregate_prompt = (
        f"Synthesize these {len(results)} analyses into a single coherent summary. "
        f"Resolve contradictions and highlight consensus:\n\n{combined}"
    )

    response = await send_task(aggregator_url, aggregate_prompt)
    return extract_text(response)


# Usage: get multiple perspectives on a technical decision
async def main():
    result = await fan_out_fan_in(
        agent_urls=[
            "http://localhost:8001",  # Security analyst
            "http://localhost:8002",  # Performance analyst
            "http://localhost:8003",  # Cost analyst
        ],
        prompts=[
            "Analyze the security implications of migrating from REST to gRPC",
            "Analyze the performance implications of migrating from REST to gRPC",
            "Analyze the cost implications of migrating from REST to gRPC",
        ],
        aggregator_url="http://localhost:8004",  # Synthesis agent
    )
    print(result)

asyncio.run(main())
```

The key insight: `asyncio.gather` with `return_exceptions=True` means one failing agent does not bring down the whole operation. The aggregator works with whatever results it gets.

For large fan-outs (10+ agents), add concurrency limits:

```python
import asyncio

SEM = asyncio.Semaphore(5)  # Max 5 concurrent requests

async def send_task_throttled(url: str, text: str) -> dict:
    async with SEM:
        return await send_task(url, text)
```

## Pattern 4: Hierarchical delegation

A coordinator delegates to sub-coordinators, each managing their own group of specialists. This is for complex systems where a flat coordinator would drown in routing decisions.

```
                  +------------------+
                  |  Top Coordinator |
                  +--------+---------+
                           |
            +--------------+--------------+
            |              |              |
            v              v              v
     +-------------+ +-------------+ +-------------+
     | Engineering | |  Marketing  | |   Finance   |
     | Coordinator | | Coordinator | | Coordinator |
     +------+------+ +------+------+ +------+------+
            |              |              |
        +---+---+     +---+---+     +---+---+
        |   |   |     |   |   |     |   |   |
        v   v   v     v   v   v     v   v   v
      Code QA Ops   Copy SEO Ads  Budget Tax Audit
```

With Google ADK, this maps directly to the sub-agent pattern:

```python
# hierarchical.py
from google.adk import Agent
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent

# Level 2: Remote specialist agents (already running as A2A servers)
code_agent = RemoteA2aAgent(
    name="code_agent",
    description="Writes and reviews code",
    agent_card_url="http://localhost:8010/.well-known/agent-card.json",
)
qa_agent = RemoteA2aAgent(
    name="qa_agent",
    description="Tests code and reports bugs",
    agent_card_url="http://localhost:8011/.well-known/agent-card.json",
)
ops_agent = RemoteA2aAgent(
    name="ops_agent",
    description="Handles deployment and infrastructure",
    agent_card_url="http://localhost:8012/.well-known/agent-card.json",
)

# Level 1: Engineering coordinator (local agent with remote sub-agents)
engineering_coordinator = Agent(
    model="gemini-2.0-flash",
    name="engineering_coordinator",
    description="Coordinates engineering tasks across code, QA, and ops teams.",
    instruction="""You coordinate engineering work. Analyze the incoming request and delegate:
- Code writing/review tasks -> code_agent
- Testing and bug reports -> qa_agent
- Deployment and infrastructure -> ops_agent

You can chain tasks: write code, then test it, then deploy it.
Summarize results before returning to the top coordinator.""",
    sub_agents=[code_agent, qa_agent, ops_agent],
)

# Similarly define marketing_coordinator, finance_coordinator...
# (Each with their own remote sub-agents)

# Level 0: Top coordinator
top_coordinator = Agent(
    model="gemini-2.0-flash",
    name="top_coordinator",
    description="Routes company requests to the right department.",
    instruction="""You are the top-level coordinator. Route requests:
- Engineering tasks (code, bugs, deployments) -> engineering_coordinator
- Marketing tasks (copy, SEO, ads) -> marketing_coordinator
- Finance tasks (budgets, taxes, audits) -> finance_coordinator

For cross-department tasks, coordinate the sequence yourself.""",
    sub_agents=[engineering_coordinator],  # Add others as defined
)
```

Expose the top coordinator over A2A:

```python
from google.adk.a2a.utils.agent_to_a2a import to_a2a

a2a_app = to_a2a(top_coordinator, port=8000)
```

Now a single request to port 8000 can cascade through the hierarchy. The top coordinator routes to engineering, engineering routes to the code agent, and results bubble back up.

## Error handling across agents

Multi-agent systems need resilient error handling. A failed agent should not crash the entire flow.

```python
# resilient_client.py
import asyncio
import httpx
from a2a_client import send_task, extract_text


async def send_with_retry(
    agent_url: str,
    text: str,
    max_retries: int = 3,
    backoff_base: float = 1.0,
) -> dict:
    """Send a task with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            return await send_task(agent_url, text)
        except httpx.TimeoutException:
            if attempt == max_retries - 1:
                raise
            wait = backoff_base * (2 ** attempt)
            print(f"Timeout, retrying in {wait}s (attempt {attempt + 1})")
            await asyncio.sleep(wait)
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                if attempt == max_retries - 1:
                    raise
                wait = backoff_base * (2 ** attempt)
                await asyncio.sleep(wait)
            else:
                raise  # 4xx errors are not retryable


async def send_with_fallback(
    primary_url: str,
    fallback_url: str,
    text: str,
) -> dict:
    """Try the primary agent, fall back to a secondary on failure."""
    try:
        return await send_with_retry(primary_url, text)
    except Exception as e:
        print(f"Primary agent failed: {e}. Trying fallback.")
        return await send_with_retry(fallback_url, text)
```

See [Error Handling Patterns for A2A Agents](/blog/a2a-error-handling-patterns) for deeper coverage of retry strategies and failure modes.

## Choosing a pattern

**Start with the coordinator.** It handles 80% of multi-agent use cases and is the easiest to reason about, debug, and extend.

Move to **pipeline** when your workflow has clear sequential stages and each stage's output becomes the next stage's input.

Use **fan-out/fan-in** when you need parallel processing -- multiple perspectives on the same input, or independent sub-tasks that can run concurrently.

Graduate to **hierarchical** only when your coordinator is managing more than 5-7 agents and routing decisions are getting complex. Adding hierarchy too early adds latency without improving clarity.

## Common mistakes

- **Over-decomposing.** Not every function needs its own agent. If two "agents" always run together and share state, they should be one agent with two tools.
- **Synchronous chains.** If Agent B always waits for Agent A, and Agent C always waits for Agent B, you have a pipeline -- build it as one instead of pretending it is a coordinator.
- **No timeouts.** An agent that hangs blocks everyone upstream. Set aggressive timeouts and handle them. See the retry code above.
- **Ignoring partial failures.** In fan-out, some agents will fail. Design your aggregator to work with 2 out of 3 results, not to crash because it expected exactly 3.

## Further reading

- [A2A Agent Cards](/blog/a2a-agent-card-explained) -- how agents discover each other
- [Google ADK Tutorial](/blog/google-adk-tutorial-2026) -- building agents that plug into these patterns
- [Error Handling Patterns](/blog/a2a-error-handling-patterns) -- handling failures in multi-agent flows
- Browse production multi-agent systems on [StackA2A](/stacks)
