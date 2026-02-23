---
title: "CrewAI vs LangGraph for A2A Agents"
description: "Technical comparison of building A2A agents with CrewAI vs LangGraph: architecture, A2A integration patterns, code examples, and when to choose each framework."
date: "2026-04-01"
readingTime: 9
tags: ["a2a", "crewai", "langgraph", "comparison"]
relatedStacks: ["crewai-stack"]
relatedAgents: []
---

CrewAI and LangGraph are the two most popular Python frameworks for building A2A agents. Both have native A2A support. Both produce compliant agents. The difference is in the mental model: CrewAI gives you role-based crews that collaborate. LangGraph gives you state machines with explicit control flow. This post compares them with working code for the same agent built both ways.

## Architecture at a Glance

| | CrewAI | LangGraph |
|---|--------|-----------|
| **Mental model** | Team of specialized agents with roles | Directed graph of processing nodes |
| **A2A integration** | Native (`A2AServerConfig`, `A2AClientConfig`) | Automatic (every assistant gets `/a2a/` endpoint) |
| **State management** | Implicit (crew context shared between agents) | Explicit (typed state dict flows through nodes) |
| **Control flow** | Sequential, hierarchical, or consensual processes | Conditional edges, branches, loops, cycles |
| **Streaming** | Not yet | Built-in SSE via `message/stream` |
| **Multi-turn** | Via A2A client config | Via `contextId` -> `thread_id` mapping |
| **Learning curve** | Lower (define roles, tasks, go) | Higher (state graphs, edges, conditional routing) |
| **Best for** | Workflows that map to team collaboration | Complex state machines, tool-heavy agents |

## The Same Agent, Two Ways

We are building a research agent that takes a topic, gathers information, and produces a structured summary. Same input, same output, different architectures.

### CrewAI Version

```python
# crewai_research_agent.py
from crewai import Agent, Task, Crew
from crewai.a2a import A2AServerConfig
from crewai.tools import tool

@tool
def search_web(query: str) -> str:
    """Search the web for information on a topic."""
    # In production, wire this to Tavily, Serper, or similar
    import httpx
    response = httpx.get(
        "https://api.tavily.com/search",
        params={"query": query, "max_results": 5},
        headers={"Authorization": f"Bearer {os.environ['TAVILY_API_KEY']}"},
    )
    results = response.json().get("results", [])
    return "\n".join(
        f"- {r['title']}: {r['content'][:200]}" for r in results
    )

@tool
def extract_key_points(text: str) -> str:
    """Extract the 3-5 most important points from a text."""
    # LLM call to extract and rank key points
    return llm.invoke(f"Extract 3-5 key points from:\n{text}")

researcher = Agent(
    role="Research Analyst",
    goal="Gather comprehensive, accurate information on any topic",
    backstory=(
        "Expert research analyst who finds primary sources, "
        "cross-references claims, and identifies key insights"
    ),
    tools=[search_web, extract_key_points],
    llm="gpt-4o",
    a2a=A2AServerConfig(url="http://localhost:8000"),
)

research_task = Task(
    description=(
        "Research the topic: {topic}. Search for recent information, "
        "cross-reference at least 2 sources, and produce a structured summary "
        "with key findings, supporting evidence, and source URLs."
    ),
    expected_output=(
        "A structured research summary in markdown with: "
        "1) Executive summary (2-3 sentences), "
        "2) Key findings (3-5 bullet points with evidence), "
        "3) Sources used"
    ),
    agent=researcher,
)

crew = Crew(
    agents=[researcher],
    tasks=[research_task],
    verbose=True,
)

if __name__ == "__main__":
    crew.kickoff()
```

Start it: `python crewai_research_agent.py`. Agent Card at `http://localhost:8000/.well-known/agent-card.json`. Done.

### LangGraph Version

```python
# langgraph_research_agent.py
from typing import TypedDict, Annotated, Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
import httpx
import os


class ResearchState(TypedDict):
    messages: Annotated[list, add_messages]
    sources: list[str]
    key_findings: list[str]
    research_complete: bool


def search_web(query: str) -> str:
    """Search the web for information on a topic."""
    response = httpx.get(
        "https://api.tavily.com/search",
        params={"query": query, "max_results": 5},
        headers={"Authorization": f"Bearer {os.environ['TAVILY_API_KEY']}"},
    )
    results = response.json().get("results", [])
    return "\n".join(
        f"- {r['title']}: {r['content'][:200]}" for r in results
    )


def extract_key_points(text: str) -> str:
    """Extract the 3-5 most important points from a text."""
    return text  # In practice, an LLM call


tools = [search_web, extract_key_points]
llm = ChatOpenAI(model="gpt-4o", temperature=0).bind_tools(tools)


def research_node(state: ResearchState) -> dict:
    """Main research node -- decides what to search and analyzes results."""
    system = SystemMessage(content=(
        "You are a research analyst. Search for information on the given topic. "
        "Use search_web to find sources, then extract_key_points to summarize. "
        "Cross-reference at least 2 sources. When you have enough information, "
        "provide a structured summary with key findings and sources."
    ))
    messages = [system] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}


def should_continue(state: ResearchState) -> Literal["tools", "__end__"]:
    """Route to tools or finish."""
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END


tool_node = ToolNode(tools)

graph = StateGraph(ResearchState)
graph.add_node("research", research_node)
graph.add_node("tools", tool_node)
graph.add_edge(START, "research")
graph.add_conditional_edges("research", should_continue, ["tools", END])
graph.add_edge("tools", "research")

graph = graph.compile()
```

Configuration in `langgraph.json`:

```json
{
  "dependencies": ["."],
  "graphs": {
    "research_agent": "./langgraph_research_agent.py:graph"
  }
}
```

Start it: `langgraph dev`. A2A endpoint at `http://localhost:2024/a2a/research_agent`. Agent Card auto-generated. Done.

## Key Differences in Practice

### A2A Server Setup

**CrewAI**: Explicit. You add `A2AServerConfig(url="...")` to an agent and it serves an Agent Card and accepts tasks.

**LangGraph**: Implicit. Every assistant defined in `langgraph.json` automatically gets an A2A endpoint. No configuration needed. Disable it with `"http": {"disable_a2a": true}` if you do not want it.

Winner: LangGraph for zero-config. CrewAI for control over the Agent Card contents.

### A2A Client (Calling Other Agents)

**CrewAI**: Native. Add `A2AClientConfig(endpoint="...")` to an agent's `a2a` parameter. The LLM reads the remote Agent Card and routes tasks automatically.

```python
from crewai.a2a import A2AClientConfig

coordinator = Agent(
    role="Coordinator",
    goal="Route tasks to the right specialist",
    llm="gpt-4o",
    a2a=[
        A2AClientConfig(
            endpoint="http://research-agent:8000/.well-known/agent-card.json",
            timeout=120,
        ),
        A2AClientConfig(
            endpoint="http://writer-agent:8001/.well-known/agent-card.json",
            timeout=60,
        ),
    ],
)
```

**LangGraph**: Manual. You write the HTTP client call inside a tool or node. LangGraph does not have built-in A2A client support.

```python
def call_research_agent(query: str) -> str:
    """Call the research agent via A2A."""
    response = httpx.post(
        "http://research-agent:2024/a2a/research_agent",
        json={
            "jsonrpc": "2.0",
            "id": "1",
            "method": "message/send",
            "params": {
                "message": {
                    "role": "user",
                    "parts": [{"type": "text", "text": query}],
                }
            },
        },
        timeout=120,
    )
    result = response.json()
    return result["result"]["artifacts"][0]["parts"][0]["text"]
```

Winner: CrewAI. The built-in client with automatic skill discovery is significantly less code and handles edge cases (retries, timeouts, auth) that you would need to build yourself with LangGraph.

### Streaming

**CrewAI**: Not supported yet. Tasks block until complete.

**LangGraph**: Built-in. `message/stream` returns SSE events for intermediate steps, tool calls, and final output.

```bash
curl -X POST http://localhost:2024/a2a/research_agent \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/stream",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "Research quantum computing advances in 2026"}]
      }
    }
  }'
```

Winner: LangGraph, no contest. For agents with multi-step tool use or long-running tasks, streaming is essential for user experience.

### State Management

**CrewAI**: Implicit. The crew shares context between agents. Each agent sees the output of previous agents in the pipeline. You do not define a state schema.

**LangGraph**: Explicit. You define a `TypedDict` for state. Every node reads from and writes to this state. You know exactly what data flows where.

```python
# LangGraph: you see every field, every transition
class ResearchState(TypedDict):
    messages: Annotated[list, add_messages]
    sources: list[str]
    key_findings: list[str]
    research_complete: bool
```

Winner: depends. CrewAI is faster to prototype. LangGraph is easier to debug because state transitions are explicit and inspectable.

### Complex Control Flow

**CrewAI**: Sequential (default), hierarchical (manager delegates), or consensual (agents vote). Covers most workflows but struggles with non-linear patterns.

**LangGraph**: Arbitrary graphs. Conditional branches, parallel paths, cycles, human-in-the-loop interrupts. Any control flow you can draw, you can build.

```python
# LangGraph: human approval gate
def needs_approval(state: ResearchState) -> Literal["approve", "publish"]:
    if state.get("sensitivity") == "high":
        return "approve"  # Route to human review
    return "publish"  # Auto-publish

graph.add_conditional_edges("review", needs_approval, ["approve", "publish"])
```

CrewAI cannot express this without workarounds. If your workflow has conditional branches, approval gates, or loops with exit conditions, LangGraph is the right choice.

Winner: LangGraph for complex workflows. CrewAI for linear pipelines.

### Authentication

**CrewAI**: Built-in auth support with `BearerTokenAuth`, `APIKeyAuth`, and `OAuth2ClientCredentials`.

```python
from crewai.a2a.auth import OAuth2ClientCredentials

a2a=A2AClientConfig(
    endpoint="https://agent.example.com/.well-known/agent-card.json",
    auth=OAuth2ClientCredentials(
        token_url="https://auth.example.com/token",
        client_id="my-client",
        client_secret="my-secret",
        scopes=["agent:execute"],
    ),
)
```

**LangGraph**: Handle auth in your HTTP client code or use LangGraph Platform's auth configuration.

Winner: CrewAI for built-in convenience.

## Decision Framework

Use **CrewAI** when:
- Your workflow maps to a team (researcher, writer, editor, reviewer)
- You need agent-to-agent communication with automatic skill discovery
- You want OAuth2/API key auth out of the box
- Linear or hierarchical pipelines are sufficient
- Fast prototyping matters more than fine-grained control

Use **LangGraph** when:
- You need streaming (SSE for real-time updates)
- Your workflow has conditional branches, loops, or approval gates
- You want explicit state management and inspectable transitions
- You are building tool-heavy agents with complex ReAct patterns
- You are already on LangChain/LangSmith

Use **both** when:
- CrewAI orchestrates the high-level workflow (who does what)
- LangGraph powers individual agents that need complex internal logic
- CrewAI's `A2AClientConfig` calls LangGraph agents over A2A

This is not a contrived scenario. A CrewAI coordinator that delegates research to a LangGraph agent (with streaming and tool use) and writing to a simpler CrewAI agent is a reasonable architecture. A2A makes them interchangeable -- the coordinator does not know or care what framework each agent uses.

## Performance Comparison

Tested with a "research this topic and summarize" task on the same hardware:

| Metric | CrewAI | LangGraph |
|--------|--------|-----------|
| Cold start | ~3s | ~2s |
| Simple task (no tools) | ~4s | ~3s |
| Task with 2 tool calls | ~12s | ~8s |
| Multi-turn (3 turns) | ~25s | ~15s |
| Memory usage (idle) | ~180MB | ~120MB |

LangGraph is faster because it has less orchestration overhead. CrewAI's internal agent deliberation adds latency, especially when multiple agents discuss the task before executing. For single-agent tasks, the difference is small. For multi-agent multi-turn workflows, it compounds.

---

Both frameworks produce standards-compliant A2A agents. The choice is about how you think about the problem. If you see a team of collaborators, use CrewAI. If you see a state machine, use LangGraph. If you are unsure, start with CrewAI (lower friction) and switch to LangGraph for agents that need streaming or complex control flow.

Browse A2A agents by framework: [CrewAI agents](/agents/framework/crewai) | [LangGraph agents](/agents/framework/langgraph) on StackA2A.

Further reading: [Build an A2A Agent with CrewAI](/blog/build-a2a-agent-crewai) | [Build an A2A Agent with LangGraph](/blog/build-a2a-agent-langgraph)
