---
title: "How to Build an A2A Agent with LangGraph"
description: "Step-by-step tutorial to build an A2A-compliant agent using LangGraph. Set up a state graph, expose it via the A2A endpoint, and test inter-agent communication."
date: "2026-02-22"
readingTime: 10
tags: ["a2a", "langgraph", "tutorial", "python"]
relatedStacks: ["langgraph-stack"]
---

**LangGraph** provides native A2A support through its platform server. Every LangGraph assistant automatically gets an A2A endpoint at `/a2a/{assistant_id}`, with an auto-generated Agent Card that other agents can discover. This makes LangGraph one of the most straightforward ways to build agents that participate in the A2A ecosystem.

This tutorial walks you through building a LangGraph agent from scratch, exposing it via A2A, and testing it with both curl and a remote consumer agent.

## What You'll Build

A **data analysis agent** that can process questions about datasets, generate insights, and return structured results. The agent will:

- Run as a LangGraph state graph with tool-calling support
- Expose an A2A endpoint with automatic Agent Card generation
- Handle both synchronous and streaming A2A requests
- Maintain conversation context across multi-turn A2A interactions

## Prerequisites

- Python 3.10 or higher
- An OpenAI API key (or any LangChain-compatible LLM provider)
- Familiarity with LangChain and graph-based agent patterns
- pip or uv package manager

## Step 1: Install Dependencies

Create a project and install LangGraph with A2A support:

```bash
mkdir data-analysis-agent && cd data-analysis-agent
python -m venv .venv
source .venv/bin/activate
pip install "langgraph-api>=0.4.21" langgraph langchain-openai
```

Set your API key:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

## Step 2: Define the State Graph

LangGraph agents are built as state graphs — directed graphs where nodes represent processing steps and edges define the flow. Create a file called `agent.py`:

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

This graph follows the standard ReAct pattern: the agent node calls the LLM, which may decide to invoke tools. If tools are called, the results feed back into the agent for a final response.

## Step 3: Configure LangGraph Server

Create a `langgraph.json` configuration file in your project root:

```json
{
  "dependencies": ["."],
  "graphs": {
    "data_analyst": "./agent.py:graph"
  }
}
```

This tells the LangGraph server where to find your graph and what assistant ID to assign it. The A2A endpoint will be available at `/a2a/data_analyst`.

## Step 4: Run the LangGraph Server

Start the development server:

```bash
langgraph dev
```

The server will start on `http://localhost:2024` by default. You should see output confirming the server is ready and the A2A endpoint is active.

## Step 5: Verify the Agent Card

Fetch the auto-generated Agent Card:

```bash
curl -s "http://localhost:2024/.well-known/agent-card.json?assistant_id=data_analyst" | python -m json.tool
```

The response will describe your agent's capabilities:

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

## Step 6: Test with message/send

Send a synchronous request to the A2A endpoint:

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

The agent will use the `calculate_statistics` tool and return results in the A2A task format.

## Step 7: Test Streaming

For real-time responses, use the `message/stream` method:

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

You will see SSE events stream back as the agent processes the request, including intermediate tool calls and the final response.

## Step 8: Multi-Turn Conversations

A2A supports multi-turn conversations using `contextId` and `taskId`. After your first request, the response includes these IDs. Include them in subsequent requests to maintain conversation context:

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

LangGraph maps `contextId` to its internal `thread_id`, so the agent has full access to the conversation history from the first request.

## Step 9: Consuming the Agent from Another Agent

To connect your LangGraph agent to another A2A agent, you can use the A2A Python SDK as a client. Here is a minimal consumer:

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

Run it while your LangGraph server is running:

```bash
python consumer.py
```

## Step 10: Disabling A2A

If you need to disable the A2A endpoint for a specific deployment, set the flag in `langgraph.json`:

```json
{
  "dependencies": ["."],
  "graphs": {
    "data_analyst": "./agent.py:graph"
  },
  "http": {
    "disable_a2a": true
  }
}
```

## Deployment

For production, deploy your LangGraph agent using the LangGraph CLI:

```bash
langgraph build -t my-agent:latest
langgraph up
```

This creates a Docker container with your agent and all dependencies. The A2A endpoint will be available at the same path, and you should update your Agent Card's `url` field to reflect the production domain.

## Next Steps

You now have a LangGraph agent that speaks A2A. For curated agent stacks and pre-built configurations using LangGraph, explore [the LangGraph stack](/stacks/langgraph-stack) on StackA2A.
