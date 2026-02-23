---
title: "Multi-Turn Conversations in A2A: State, Context, and Flow Control"
description: "How multi-turn works in A2A: the input-required state, task ID continuity, conversation context, clarification flows, and practical examples of agents asking for more information."
date: "2026-03-08"
readingTime: 8
tags: ["a2a", "multi-turn", "conversations", "guide"]
relatedStacks: ["multi-agent"]
---

Most agent interactions aren't one-shot. An agent analyzing data might need to ask which columns to focus on. A code review agent might want clarification on the coding standards to apply. A booking agent needs to confirm details before making a reservation.

A2A handles this through the `input-required` task state and task ID continuity. The agent pauses execution, signals that it needs more information, and waits for the client to send a follow-up message on the same task. No session cookies, no separate state management layer. The task ID is the session.

## The core mechanism

Multi-turn in A2A works through three elements:

1. **Task ID continuity** — every message in a conversation shares the same task ID
2. **`input-required` state** — the agent signals it needs more input before proceeding
3. **Status messages** — the agent tells the client what it needs

When an agent returns `state: "input-required"`, the task is paused. The client reads the agent's message (which explains what's needed), gets the answer from the user (or another agent), and sends a new `message/send` or `message/stream` with the same task ID. The agent picks up where it left off.

```
Client                              Agent
  |                                    |
  |-- message/send (task-001) -------->|
  |   "Analyze this dataset"           |
  |                                    |
  |<-- task-001: input-required -------|
  |    "Which columns should I         |
  |     focus on?"                     |
  |                                    |
  |-- message/send (task-001) -------->|
  |   "Revenue and profit margin"      |
  |                                    |
  |<-- task-001: input-required -------|
  |    "Should I include Q4 data?      |
  |     It has some anomalies."        |
  |                                    |
  |-- message/send (task-001) -------->|
  |   "Yes, include it but flag        |
  |    the anomalies"                  |
  |                                    |
  |<-- task-001: completed ------------|
  |    [full analysis artifact]        |
```

## The input-required response

Here's what an `input-required` response looks like as JSON-RPC:

```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "result": {
    "id": "task-001",
    "status": {
      "state": "input-required",
      "message": {
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "I found 47 columns in the dataset. Which ones should I focus the analysis on? Here are the available columns:\n\n- revenue, cost, profit_margin, units_sold\n- region, country, city\n- product_category, product_name, sku\n- date, quarter, fiscal_year"
          }
        ]
      }
    },
    "artifacts": []
  }
}
```

The agent can also include partial artifacts alongside an `input-required` status. For example, it might return a preliminary analysis and then ask whether to go deeper:

```json
{
  "jsonrpc": "2.0",
  "id": "req-2",
  "result": {
    "id": "task-001",
    "status": {
      "state": "input-required",
      "message": {
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "Here's the initial analysis. Revenue shows a significant dip in Q3. Should I investigate the root cause, or is this summary sufficient?"
          }
        ]
      }
    },
    "artifacts": [
      {
        "parts": [
          {
            "kind": "text",
            "text": "## Revenue Analysis (Preliminary)\n\nTotal revenue: $4.2M\nQ1: $1.1M | Q2: $1.3M | Q3: $0.7M | Q4: $1.1M\n\nQ3 shows a 46% decline from Q2..."
          }
        ]
      }
    ]
  }
}
```

## Sending follow-up messages

The follow-up uses the same task ID. That's the entire mechanism for maintaining conversation context:

```json
{
  "jsonrpc": "2.0",
  "id": "req-3",
  "method": "message/send",
  "params": {
    "id": "task-001",
    "message": {
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "Yes, investigate the Q3 dip. Also break down by region."
        }
      ]
    }
  }
}
```

The agent receives this, accesses the full conversation history for `task-001`, and continues processing.

## Building a multi-turn agent

Here's a Python agent that implements a multi-turn booking flow:

```python
from a2a.server import A2AServer, TaskContext

class BookingAgent:
    """Agent that books meeting rooms through a multi-turn conversation."""

    async def handle_task(self, context: TaskContext):
        message = context.current_message
        user_text = message["parts"][0]["text"].lower()
        history = context.message_history

        # Determine conversation stage based on collected info
        booking_info = self.extract_booking_info(history)

        if not booking_info.get("date"):
            await context.set_status(
                state="input-required",
                message="What date do you need the room? (e.g., 2026-03-15)",
            )
            return

        if not booking_info.get("time"):
            await context.set_status(
                state="input-required",
                message=f"Got it — {booking_info['date']}. What time and duration? (e.g., 2pm for 1 hour)",
            )
            return

        if not booking_info.get("room_size"):
            await context.set_status(
                state="input-required",
                message=f"Booking for {booking_info['date']} at {booking_info['time']}. How many people? I'll find a room that fits.",
            )
            return

        # All info collected — find available rooms
        available = await self.find_rooms(booking_info)

        if not available:
            await context.set_status(
                state="input-required",
                message=f"No rooms available for {booking_info['room_size']} people on {booking_info['date']} at {booking_info['time']}. Want to try a different time?",
            )
            return

        if not booking_info.get("confirmed_room"):
            room_list = "\n".join(
                f"- **{r['name']}** (capacity: {r['capacity']}, floor {r['floor']})"
                for r in available
            )
            await context.set_status(
                state="input-required",
                message=f"Available rooms:\n\n{room_list}\n\nWhich room would you like?",
            )
            return

        # Book the room
        confirmation = await self.book_room(
            booking_info["confirmed_room"],
            booking_info["date"],
            booking_info["time"],
        )

        await context.add_artifact(
            parts=[{
                "kind": "text",
                "text": f"## Booking Confirmed\n\n"
                       f"- **Room:** {confirmation['room']}\n"
                       f"- **Date:** {confirmation['date']}\n"
                       f"- **Time:** {confirmation['time']}\n"
                       f"- **Confirmation ID:** {confirmation['id']}\n",
            }]
        )
        await context.set_status(state="completed")

    def extract_booking_info(self, history: list[dict]) -> dict:
        """Extract booking details from conversation history."""
        info = {}
        # In production, use an LLM to extract structured data
        # from the full conversation history
        for msg in history:
            if msg["role"] == "user":
                text = msg["parts"][0].get("text", "")
                # Parse dates, times, room sizes from text
                # This is simplified — use dateparser or an LLM
                if any(month in text for month in ["january", "february", "march"]):
                    info["date"] = text.strip()
                # ... additional extraction logic
        return info
```

## Multi-turn with streaming

Multi-turn works with streaming too. The agent streams partial results, then pauses with `input-required`:

```python
async def stream_task(agent_url: str, task_id: str, messages: list[str]):
    """Send multiple messages in a multi-turn conversation."""
    for i, msg in enumerate(messages):
        print(f"\n--- Turn {i + 1} ---")
        print(f"User: {msg}")

        artifacts = {}
        async for event in stream_task_events(agent_url, task_id, msg):
            if event.event_type == "status":
                state = event.data["status"]["state"]

                if state == "input-required":
                    agent_msg = event.data["status"]["message"]["parts"][0]["text"]
                    print(f"Agent (needs input): {agent_msg}")
                    break  # Exit stream, next message in loop will continue

                elif state == "completed":
                    print("Agent: Task completed")

            elif event.event_type == "artifact":
                artifact = event.data["artifact"]
                idx = artifact["index"]
                text = artifact["parts"][0].get("text", "")

                if artifact.get("append") and idx in artifacts:
                    artifacts[idx] += text
                else:
                    artifacts[idx] = text

        # Print any artifacts from this turn
        for idx in sorted(artifacts):
            print(f"Artifact {idx}: {artifacts[idx][:200]}...")
```

## Conversation context management

A2A doesn't prescribe how the agent maintains context internally. The protocol delivers all messages with the same task ID — the agent decides how to use them. Common patterns:

### Full history replay

Pass the entire conversation history to the LLM on each turn:

```python
async def handle_with_full_history(self, context: TaskContext):
    """Replay full history for each turn."""
    messages = []
    for msg in context.message_history:
        role = "user" if msg["role"] == "user" else "assistant"
        text = msg["parts"][0].get("text", "")
        messages.append({"role": role, "content": text})

    # Add the current message
    messages.append({
        "role": "user",
        "content": context.current_message["parts"][0]["text"],
    })

    response = await self.llm.generate(messages=messages)
    # ... process response
```

### Structured state extraction

Extract structured state from the conversation instead of replaying raw messages:

```python
from pydantic import BaseModel

class ConversationState(BaseModel):
    """Structured state extracted from conversation history."""
    topic: str | None = None
    constraints: list[str] = []
    preferences: dict = {}
    stage: str = "initial"
    collected_data: dict = {}

async def handle_with_state(self, context: TaskContext):
    """Extract and maintain structured conversation state."""
    # Load or initialize state
    state = context.metadata.get("state", ConversationState())

    # Update state with new message
    new_info = await self.extract_info(
        context.current_message,
        existing_state=state,
    )
    state = state.model_copy(update=new_info)

    # Decide next action based on state
    if state.stage == "gathering_requirements":
        missing = self.check_missing_fields(state)
        if missing:
            await context.set_status(
                state="input-required",
                message=f"I still need: {', '.join(missing)}",
            )
            return

        state.stage = "processing"
        # Fall through to processing

    if state.stage == "processing":
        result = await self.process(state)
        await context.add_artifact(parts=[{"kind": "text", "text": result}])
        await context.set_status(state="completed")
```

## Multi-turn between agents

Multi-turn isn't just for human-agent conversations. An orchestrator agent can have a multi-turn exchange with a specialist agent:

```python
async def orchestrator_flow(specialist_url: str):
    """Orchestrator that handles multi-turn with a specialist agent."""
    task_id = "task-orchestrated-001"

    # Initial request
    response = await send_message(
        specialist_url,
        task_id,
        "Analyze the Q3 financial data for anomalies",
    )

    while response["status"]["state"] == "input-required":
        # The specialist agent needs more info
        question = response["status"]["message"]["parts"][0]["text"]

        # The orchestrator can answer autonomously using its own knowledge
        # or tools, without involving the human
        answer = await generate_answer(question)

        response = await send_message(
            specialist_url,
            task_id,
            answer,
        )

    # Specialist is done
    if response["status"]["state"] == "completed":
        return response["artifacts"]
```

This is where multi-turn becomes powerful in [multi-agent architectures](/stacks). An orchestrator dispatches work to specialists, and when a specialist needs clarification, the orchestrator can often answer from its own context — no human round-trip needed.

## Design guidelines

**Don't ask for everything upfront.** The whole point of multi-turn is progressive disclosure. Ask for the minimum needed to start, then refine.

**Keep `input-required` messages specific.** "I need more information" is useless. "Which of these 3 regions should I include in the analysis?" gives the user something actionable.

**Include partial results.** When returning `input-required`, attach any artifacts you've already produced. The user can see progress and make better-informed decisions about what to provide next.

**Limit turns.** If your agent routinely needs 8 rounds of clarification, the UX is broken. Aim for 2-3 turns max in most flows. If you need more, reconsider whether the initial prompt should include a structured form or template.

**Handle abandonment.** Users walk away mid-conversation. Implement task timeouts. After a configurable period with no follow-up, transition the task to `canceled` and clean up resources.

**Test with automated clients.** Write integration tests that simulate multi-turn flows end-to-end. Each test sends the initial message, reads the `input-required` response, sends a follow-up, and verifies the final result.

For more on streaming the intermediate turns, see [A2A Streaming](/blog/a2a-streaming-protocol-guide). For discovery of agents that support multi-turn, check the [agent directory](/agents) and look for agents advertising `stateTransitionHistory` in their capabilities.
