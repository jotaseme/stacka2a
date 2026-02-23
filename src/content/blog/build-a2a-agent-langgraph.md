---
title: "How to Build an A2A Agent with LangGraph"
description: "Build an A2A-compliant agent using LangGraph. State graph setup, automatic A2A endpoint exposure, streaming, multi-turn conversations, and agent-to-agent communication."
date: "2026-02-14"
readingTime: 8
tags: ["a2a", "langgraph", "tutorial", "python"]
relatedStacks: ["langgraph-stack"]
---

**LangGraph gives you A2A for free.** Every LangGraph assistant automatically gets an A2A endpoint at `/a2a/{assistant_id}` with an auto-generated Agent Card. No adapter layer, no protocol wiring. Define your state graph, start the platform server, and your agent is discoverable and callable by any A2A client.

We are building a data analysis agent with tool-calling support, then testing it over A2A with curl and a consumer script.

## Install dependencies

You need Python 3.10+ and an OpenAI API key (or any LangChain-compatible provider).

```bash
mkdir data-analysis-agent && cd data-analysis-agent
python -m venv .venv
source .venv/bin/activate
pip install "langgraph-api>=0.4.21" langgraph langchain-openai
```

```bash
export OPENAI_API_KEY="your-api-key-here"
```

## Define the state graph

LangGraph agents are directed state graphs — nodes are processing steps, edges define control flow. Create `agent.py`:

```python
# agent.py
from typing import TypedDict, Annotated, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode


# Define the agent's state
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


# Define tools the agent can use
def calculate_statistics(data: str, metric: str = "summary") -> str:
    """Calculate statistics for the provided data.

    Args:
        data: A comma-separated list of numbers.
        metric: The type of calculation — 'summary', 'mean', 'median', or 'std'.

    Returns:
        The calculated statistic as a formatted string.
    """
    import statistics

    numbers = [float(x.strip()) for x in data.split(",")]
    if metric == "mean":
        return f"Mean: {statistics.mean(numbers):.2f}"
    elif metric == "median":
        return f"Median: {statistics.median(numbers):.2f}"
    elif metric == "std":
        return f"Standard Deviation: {statistics.stdev(numbers):.2f}"
    else:
        return (
            f"Count: {len(numbers)}, "
            f"Mean: {statistics.mean(numbers):.2f}, "
            f"Median: {statistics.median(numbers):.2f}, "
            f"Min: {min(numbers):.2f}, "
            f"Max: {max(numbers):.2f}"
        )


def analyze_trend(values: str) -> str:
    """Analyze the trend direction of a series of numbers.

    Args:
        values: A comma-separated list of numbers in chronological order.

    Returns:
        A description of the trend.
    """
    numbers = [float(x.strip()) for x in values.split(",")]
    if len(numbers) < 2:
        return "Need at least 2 data points to analyze a trend."

    diffs = [numbers[i + 1] - numbers[i] for i in range(len(numbers) - 1)]
    avg_diff = sum(diffs) / len(diffs)
    positive = sum(1 for d in diffs if d > 0)
    negative = sum(1 for d in diffs if d < 0)

    if positive > negative:
        direction = "upward"
    elif negative > positive:
        direction = "downward"
    else:
        direction = "flat"

    return (
        f"Trend: {direction}. "
        f"Average change per step: {avg_diff:+.2f}. "
        f"Total change: {numbers[-1] - numbers[0]:+.2f} "
        f"({len(numbers)} data points)."
    )


tools = [calculate_statistics, analyze_trend]

# Initialize the LLM with tool binding
llm = ChatOpenAI(model="gpt-4o", temperature=0)
llm_with_tools = llm.bind_tools(tools)


# Define graph nodes
def call_model(state: AgentState) -> dict:
    """Invoke the LLM with the current message history."""
    system = SystemMessage(
        content=(
            "You are a data analysis assistant. Help users understand their data "
            "by calculating statistics, identifying trends, and providing insights. "
            "Use the available tools when numerical analysis is needed. "
            "Be concise and precise in your answers."
        )
    )
    messages = [system] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


def should_continue(state: AgentState) -> str:
    """Determine whether to use tools or return the final response."""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END


# Build the graph
tool_node = ToolNode(tools)

graph_builder = StateGraph(AgentState)
graph_builder.add_node("agent", call_model)
graph_builder.add_node("tools", tool_node)
graph_builder.add_edge(START, "agent")
graph_builder.add_conditional_edges("agent", should_continue, ["tools", END])
graph_builder.add_edge("tools", "agent")

graph = graph_builder.compile()
```

Standard ReAct pattern: agent calls the LLM, LLM optionally invokes tools, tool results feed back for a final response.

## Configure the LangGraph server

Create `langgraph.json` in your project root:

```json
{
  "dependencies": ["."],
  "graphs": {
    "data_analyst": "./agent.py:graph"
  }
}
```

The assistant ID `data_analyst` becomes the A2A endpoint path: `/a2a/data_analyst`.

## Start the server

```bash
langgraph dev
```

Starts on `http://localhost:2024` by default. The A2A endpoint is immediately active.

## Verify the Agent Card

```bash
curl -s "http://localhost:2024/.well-known/agent-card.json?assistant_id=data_analyst" | python -m json.tool
```

```json
{
    "name": "data_analyst",
    "description": "LangGraph agent",
    "version": "1.0.0",
    "url": "http://localhost:2024/a2a/data_analyst",
    "capabilities": {
        "streaming": true,
        "pushNotifications": false
    },
    "defaultInputModes": ["text/plain"],
    "defaultOutputModes": ["text/plain"],
    "skills": []
}
```

## Test with message/send

```bash
curl -X POST http://localhost:2024/a2a/data_analyst \
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
            "type": "text",
            "text": "Calculate the mean, median, and standard deviation of: 12, 15, 18, 22, 25, 30, 35"
          }
        ]
      }
    }
  }'
```

The agent uses `calculate_statistics` and returns results in the A2A task format.

## Test streaming

```bash
curl -X POST http://localhost:2024/a2a/data_analyst \
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
            "type": "text",
            "text": "Analyze the trend in these monthly revenue figures: 10000, 12000, 11500, 14000, 16000, 15500, 18000"
          }
        ]
      }
    }
  }'
```

SSE events stream back including intermediate tool calls and the final response.

## Multi-turn conversations

A2A supports multi-turn via `contextId` and `taskId`. After your first request, the response includes these IDs. Include them in follow-up requests:

```bash
curl -X POST http://localhost:2024/a2a/data_analyst \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req-3",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "type": "text",
            "text": "Now compare that to last year: 8000, 8500, 9000, 9200, 10000, 10500, 11000"
          }
        ],
        "contextId": "ctx-from-previous-response",
        "taskId": "task-from-previous-response"
      }
    }
  }'
```

LangGraph maps `contextId` to its internal `thread_id`, so conversation history carries over automatically.

## Consume from another agent

A minimal A2A client using `httpx`:

```python
# consumer.py
import httpx
import json
import uuid

A2A_ENDPOINT = "http://localhost:2024/a2a/data_analyst"

def send_message(text: str) -> dict:
    """Send a message to the data analyst agent via A2A."""
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

    response = httpx.post(
        A2A_ENDPOINT,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    return response.json()

if __name__ == "__main__":
    result = send_message(
        "Calculate summary statistics for: 45, 67, 23, 89, 12, 56, 78, 34"
    )
    print(json.dumps(result, indent=2))
```

```bash
python consumer.py
```

> To disable A2A on a deployment, set `"http": {"disable_a2a": true}` in `langgraph.json`.

## Deployment

Build and run with the LangGraph CLI:

```bash
langgraph build -t my-agent:latest
langgraph up
```

This creates a Docker container with your agent. The A2A endpoint is available at the same path — update the Agent Card `url` to your production domain.
