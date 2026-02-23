---
title: "A2A Protocol vs AutoGen: Interoperability vs Orchestration"
description: "Comparing A2A (inter-agent communication protocol) with AutoGen (multi-agent orchestration framework). Different layers, different problems. How to use them together."
date: "2026-03-14"
readingTime: 8
tags: ["a2a", "autogen", "comparison", "multi-agent"]
relatedStacks: ["autogen-stack"]
relatedAgents: []
---

A2A and AutoGen show up in the same conversations, but they're not the same kind of thing. A2A is a wire protocol — it defines how agents communicate over HTTP. AutoGen is an orchestration framework — it defines how agents are structured, how they collaborate, and how conversations flow within a multi-agent system.

Comparing them directly is like comparing HTTP with Django. One is the transport layer. The other is the application framework built on top of it. You'll often want both.

## What AutoGen does

AutoGen (by Microsoft) is a framework for building multi-agent applications. You define agents, assign them roles, and configure how they interact — who talks to whom, in what order, with what termination conditions.

A basic AutoGen setup:

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient

model_client = OpenAIChatCompletionClient(model="gpt-4o")

# Define agents with specific roles
researcher = AssistantAgent(
    "researcher",
    model_client=model_client,
    system_message="""You are a research specialist. When given a topic,
    find key facts, statistics, and recent developments. Present your
    findings in a structured format with sources.""",
)

writer = AssistantAgent(
    "writer",
    model_client=model_client,
    system_message="""You are a technical writer. Take research findings
    and produce clear, well-structured content. Focus on accuracy and
    readability. Say 'DONE' when the article is complete.""",
)

reviewer = AssistantAgent(
    "reviewer",
    model_client=model_client,
    system_message="""You are an editor. Review content for accuracy,
    clarity, and completeness. Provide specific feedback. If the content
    is ready for publication, say 'APPROVED'.""",
)

# Configure the conversation flow
termination = TextMentionTermination("APPROVED")
team = RoundRobinGroupChat(
    [researcher, writer, reviewer],
    termination_condition=termination,
)

# Run the team
result = await team.run(task="Write a technical overview of WebAssembly")
```

AutoGen handles:
- Agent definitions and role assignment
- Conversation routing between agents
- Termination conditions
- Message history management
- Human-in-the-loop patterns
- Tool registration and execution

Everything runs in a single process (or a coordinated set of processes). AutoGen manages the full lifecycle.

## What A2A does

A2A is a communication protocol. It defines how one agent sends work to another over HTTP, regardless of what framework either agent uses.

```python
# A2A: send a task to any agent that speaks the protocol
from a2a.client import A2AClient

client = A2AClient(url="https://research-agent.example.com")

# Discover what the agent can do
card = await client.get_agent_card()
print(f"Agent: {card.name}")
print(f"Skills: {[s.name for s in card.skills]}")

# Send a task
response = await client.send_message(
    message={
        "role": "user",
        "parts": [{"kind": "text", "text": "Research WebAssembly trends in 2026"}],
    }
)
```

A2A handles:
- Agent discovery via [Agent Cards](/blog/a2a-agent-card-explained)
- Message format and transport (JSON-RPC over HTTP)
- Task lifecycle (submitted, working, input-required, completed, failed)
- Streaming via SSE ([streaming guide](/blog/a2a-streaming-protocol-guide))
- [Multi-turn conversations](/blog/a2a-multi-turn-conversations)
- Authentication declarations

A2A doesn't care how the agent is implemented internally. It could be AutoGen, LangGraph, CrewAI, a Spring Boot app, or a shell script. The protocol is framework-agnostic.

## The layer distinction

```
+---------------------------------+
|         Application             |
|   (Your multi-agent system)     |
+---------------------------------+
|      Orchestration Layer        |
|   AutoGen, CrewAI, LangGraph    |
|   (How agents collaborate       |
|    within a system)             |
+---------------------------------+
|      Communication Layer        |
|   A2A Protocol                  |
|   (How agents talk across       |
|    system boundaries)           |
+---------------------------------+
|      Transport Layer            |
|   HTTP, SSE, JSON-RPC           |
+---------------------------------+
```

AutoGen operates at the orchestration layer. It manages how agents within your system collaborate. A2A operates at the communication layer. It manages how agents across systems talk to each other.

## Key differences

| Aspect | A2A | AutoGen |
|--------|-----|---------|
| **Type** | Wire protocol | Orchestration framework |
| **Scope** | Inter-agent communication | Full agent lifecycle |
| **Language** | Language-agnostic (HTTP) | Python-first |
| **Agent location** | Remote (over network) | Local (in-process) or remote |
| **Discovery** | Agent Cards | Configuration-based |
| **Conversation control** | Task states + messages | Team patterns (round-robin, selector, swarm) |
| **Streaming** | SSE protocol-level | In-process streaming |
| **Framework coupling** | None | Tight (AutoGen APIs) |
| **Primary use case** | Cross-system interop | Single-system orchestration |

## Using AutoGen agents with A2A

This is the practical question: how do you expose AutoGen agents over A2A so external systems can use them?

### Wrapping an AutoGen team as an A2A agent

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient
from a2a.server import A2AServer, InMemoryTaskStore
from a2a.types import AgentCard, AgentSkill, AgentCapabilities

model_client = OpenAIChatCompletionClient(model="gpt-4o")


class AutoGenA2AAgent:
    """Exposes an AutoGen team as an A2A agent."""

    def __init__(self):
        self.researcher = AssistantAgent(
            "researcher",
            model_client=model_client,
            system_message="You research topics thoroughly with facts and sources.",
        )
        self.writer = AssistantAgent(
            "writer",
            model_client=model_client,
            system_message="You write clear technical content. Say DONE when finished.",
        )
        self.termination = TextMentionTermination("DONE")
        self.team = RoundRobinGroupChat(
            [self.researcher, self.writer],
            termination_condition=self.termination,
        )

    async def handle_task(self, context):
        """Handle an incoming A2A task by running the AutoGen team."""
        user_text = context.current_message["parts"][0]["text"]

        # Signal that we're working
        await context.set_status(state="working", message="Research team activated...")

        # Run the AutoGen team
        result = await self.team.run(task=user_text)

        # Extract the final output from the team's conversation
        final_message = result.messages[-1]
        output_text = final_message.content

        await context.add_artifact(
            parts=[{"kind": "text", "text": output_text}]
        )
        await context.set_status(state="completed")


# Define the Agent Card
card = AgentCard(
    name="Research & Writing Team",
    description="A multi-agent team that researches topics and produces well-written technical content.",
    version="1.0.0",
    url="http://localhost:8001",
    capabilities=AgentCapabilities(streaming=False, pushNotifications=False),
    skills=[
        AgentSkill(
            id="research-and-write",
            name="Research & Write",
            description="Researches a topic and produces a technical article with sources.",
            tags=["research", "writing", "technical"],
            examples=[
                "Write a technical overview of WebAssembly",
                "Research and summarize the state of quantum computing in 2026",
            ],
        ),
    ],
)

# Create and run the A2A server
agent = AutoGenA2AAgent()
server = A2AServer(
    agent=agent,
    agent_card=card,
    task_store=InMemoryTaskStore(),
    port=8001,
)
server.run()
```

Now any A2A client — regardless of framework — can use your AutoGen team:

```bash
# Any agent can discover and call your AutoGen team
curl http://localhost:8001/.well-known/agent-card.json
```

### AutoGen agent consuming A2A agents

Going the other direction: an AutoGen agent that delegates to external A2A agents as tools.

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_core.tools import FunctionTool
from a2a.client import A2AClient

# Create a tool that calls an external A2A agent
async def call_data_agent(query: str) -> str:
    """Send an analysis request to the external data analysis A2A agent.

    Args:
        query: The analysis request in natural language.

    Returns:
        The analysis result from the remote agent.
    """
    client = A2AClient(url="https://data-agent.example.com")
    response = await client.send_message(
        message={
            "role": "user",
            "parts": [{"kind": "text", "text": query}],
        }
    )

    # Extract text from artifacts
    results = []
    for artifact in response.get("artifacts", []):
        for part in artifact.get("parts", []):
            if part.get("kind") == "text":
                results.append(part["text"])

    return "\n".join(results)


async def call_code_agent(code_request: str) -> str:
    """Send a code generation request to the external code A2A agent.

    Args:
        code_request: Description of the code to generate.

    Returns:
        Generated code from the remote agent.
    """
    client = A2AClient(url="https://code-agent.example.com")
    response = await client.send_message(
        message={
            "role": "user",
            "parts": [{"kind": "text", "text": code_request}],
        }
    )

    results = []
    for artifact in response.get("artifacts", []):
        for part in artifact.get("parts", []):
            if part.get("kind") == "text":
                results.append(part["text"])

    return "\n".join(results)


# Register A2A agents as AutoGen tools
data_tool = FunctionTool(call_data_agent, description="Analyze data using remote A2A agent")
code_tool = FunctionTool(call_code_agent, description="Generate code using remote A2A agent")

coordinator = AssistantAgent(
    "coordinator",
    model_client=model_client,
    system_message="""You coordinate complex tasks. Use the data analysis tool
    for data questions and the code generation tool for code requests.
    Combine results from multiple tools when needed.""",
    tools=[data_tool, code_tool],
)
```

This pattern lets AutoGen orchestrate a mix of local agents and remote A2A agents. The coordinator doesn't know or care that some of its "tools" are remote AI agents. It just calls them.

## Dynamic agent discovery with AutoGen

A more advanced pattern: AutoGen agents that discover A2A agents at runtime.

```python
from a2a.client import A2AClient

async def discover_and_register_agents(
    agent_urls: list[str],
) -> list[FunctionTool]:
    """Discover A2A agents and create AutoGen tools for each skill."""
    tools = []

    for url in agent_urls:
        client = A2AClient(url=url)
        card = await client.get_agent_card()

        for skill in card.skills:
            # Create a tool for each skill
            async def make_tool_fn(agent_url, skill_id):
                async def tool_fn(request: str) -> str:
                    c = A2AClient(url=agent_url)
                    response = await c.send_message(
                        message={
                            "role": "user",
                            "parts": [{"kind": "text", "text": request}],
                        }
                    )
                    return extract_text(response)
                return tool_fn

            fn = await make_tool_fn(url, skill.id)
            fn.__name__ = f"a2a_{skill.id.replace('-', '_')}"
            fn.__doc__ = f"{skill.description} (via {card.name})"

            tools.append(FunctionTool(fn, description=skill.description))

    return tools


# Discover available agents and wire them into AutoGen
agent_urls = [
    "https://research-agent.example.com",
    "https://code-agent.example.com",
    "https://data-agent.example.com",
]

tools = await discover_and_register_agents(agent_urls)

# Create an AutoGen agent with dynamically discovered A2A tools
dynamic_agent = AssistantAgent(
    "dynamic_coordinator",
    model_client=model_client,
    system_message="You have access to various specialist agents. Use the most appropriate one for each task.",
    tools=tools,
)
```

## When to use each

**Use AutoGen when:**
- All agents run within your system
- You need fine-grained conversation control (turn-taking, termination, human approval)
- Agents share memory, tools, and context tightly
- You want structured team patterns (round-robin, selector, swarm)
- Python is your primary language

**Use A2A when:**
- Agents cross system boundaries (different teams, organizations, clouds)
- You need framework-agnostic interoperability
- Agents are built in different languages or frameworks
- You want capability-based discovery
- External consumers need to use your agents

**Use both when:**
- Your internal system uses AutoGen for orchestration
- External agents need to call into or be called by your system
- You want to mix local AutoGen agents with remote A2A-compatible agents from any framework

The combination is natural. AutoGen manages the complexity of multi-agent workflows within your system. A2A handles the boundary — how your system's agents interact with the outside world.

Explore [AutoGen-compatible stacks](/stacks/autogen-stack) for production patterns, or browse the [agent directory](/agents) for A2A agents you can integrate with your AutoGen teams.
