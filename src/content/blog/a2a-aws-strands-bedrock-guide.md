---
title: "AWS Strands + A2A: Deploy Agents on Amazon Bedrock"
description: "How to build A2A protocol agents with AWS Strands Agents SDK and deploy them on Amazon Bedrock AgentCore for cloud-native multi-agent systems."
date: "2026-02-23"
readingTime: 7
tags: ["a2a", "aws", "strands", "bedrock", "cloud", "deployment"]
relatedStacks: ["multi-agent"]
relatedAgents: ["sample-agentic-frameworks-on-aws"]
---

The **Strands Agents SDK** is an open-source Python and TypeScript framework from AWS for building AI agents. Amazon Bedrock AgentCore Runtime is a serverless runtime that deploys and scales those agents with native A2A protocol support. Together they give you the shortest path from a local agent prototype to a production multi-agent system running on AWS.

This guide walks through building a Strands agent, exposing it over A2A, testing locally, and deploying to Bedrock AgentCore. We also cover inter-agent communication and IAM security.

## What is Strands Agents SDK

Strands takes a model-driven approach: you define an agent with a system prompt, a set of tools, and a model provider. The SDK handles the agentic loop, tool dispatch, and conversation management. It supports Amazon Bedrock models by default but also works with Anthropic, OpenAI, Ollama, and others through a pluggable provider interface.

The A2A integration is built in. Install the `a2a` extra and you can expose any Strands agent as a standards-compliant A2A server in a few lines of code.

## Install Strands with A2A support

You need Python 3.10+ and AWS credentials configured locally.

```bash
mkdir strands-a2a && cd strands-a2a
python -m venv .venv
source .venv/bin/activate
pip install 'strands-agents[a2a]'
pip install strands-agents-tools
```

For Bedrock AgentCore deployment, also install the deployment toolkit:

```bash
pip install bedrock-agentcore
pip install bedrock-agentcore-starter-toolkit
```

## Create an A2A agent

Build a Strands agent and wrap it with `A2AServer`. The server auto-generates an Agent Card from the agent metadata and serves it at `/.well-known/agent-card.json`.

```python
# server.py
import logging
from strands import Agent
from strands.multiagent.a2a import A2AServer
from strands_tools.calculator import calculator

logging.basicConfig(level=logging.INFO)

strands_agent = Agent(
    name="Calculator Agent",
    description="Performs arithmetic operations, unit conversions, and mathematical analysis.",
    tools=[calculator],
    callback_handler=None
)

a2a_server = A2AServer(
    agent=strands_agent,
    host="0.0.0.0",
    port=9000,
    version="1.0.0"
)

a2a_server.serve()
```

Run it:

```bash
python server.py
```

Verify the Agent Card:

```bash
curl -s http://localhost:9000/.well-known/agent-card.json | python -m json.tool
```

The card contains the agent name, description, URL, capabilities (streaming support), and auto-generated skills derived from the agent's tools.

## Customize skills and the Agent Card

Auto-generated skills work for development. For production, define explicit skills with examples and tags so other agents can discover your agent by capability:

```python
from a2a.types import AgentSkill

custom_skills = [
    AgentSkill(
        id="arithmetic",
        name="Arithmetic Operations",
        description="Performs addition, subtraction, multiplication, division, and exponentiation.",
        tags=["math", "calculator", "arithmetic"],
        examples=[
            "What is 101 * 11?",
            "Calculate 2^16",
        ],
    ),
    AgentSkill(
        id="unit-conversion",
        name="Unit Conversion",
        description="Converts between units of measurement including length, weight, and temperature.",
        tags=["math", "conversion", "units"],
        examples=[
            "Convert 5 miles to kilometers",
        ],
    ),
]

a2a_server = A2AServer(
    agent=strands_agent,
    host="0.0.0.0",
    port=9000,
    version="1.0.0",
    skills=custom_skills
)
```

## Test with a JSON-RPC call

Send a message using the A2A protocol's `message/send` method:

```bash
curl -X POST http://localhost:9000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req-001",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"kind": "text", "text": "What is 101 * 11?"}],
        "messageId": "msg-001"
      }
    }
  }' | jq .
```

## Inter-agent communication

Strands provides `A2AAgent` to consume remote A2A servers. You can use it standalone or wire it as a tool into an orchestrator agent.

```python
# client.py
from strands.agent.a2a_agent import A2AAgent

calculator = A2AAgent(
    endpoint="http://localhost:9000",
    name="calculator",
    timeout=300
)

result = calculator("What is 2^32?")
print(result.message)
```

### Orchestrator pattern

Wrap remote A2A agents as tools inside a coordinator agent. The orchestrator delegates tasks based on skill matching:

```python
from strands import Agent, tool
from strands.agent.a2a_agent import A2AAgent

calc_agent = A2AAgent(endpoint="http://calculator-service:9000", name="calculator")
research_agent = A2AAgent(endpoint="http://research-service:9000", name="researcher")

@tool
def calculate(expression: str) -> str:
    """Perform a mathematical calculation."""
    result = calc_agent(expression)
    return str(result.message["content"][0]["text"])

@tool
def research(topic: str) -> str:
    """Research a topic and return a summary."""
    result = research_agent(topic)
    return str(result.message["content"][0]["text"])

orchestrator = Agent(
    system_prompt="You coordinate tasks. Use calculate for math and research for information.",
    tools=[calculate, research]
)
```

You can also use the built-in `A2AClientToolProvider` to auto-discover remote agents and register them as tools:

```python
from strands import Agent
from strands_tools.a2a_client import A2AClientToolProvider

provider = A2AClientToolProvider(
    known_agent_urls=[
        "http://calculator-service:9000",
        "http://research-service:9000",
    ]
)

orchestrator = Agent(tools=provider.tools)
response = orchestrator("What is the population of France times 3?")
```

## Deploy to Bedrock AgentCore

Bedrock AgentCore Runtime runs A2A servers as stateless HTTP services on port 9000. It handles session isolation in dedicated microVMs, auto-scaling, and authentication.

### Prepare for deployment

Adapt the server to read the runtime URL from an environment variable and mount on FastAPI:

```python
# my_a2a_server.py
import os
import logging
from strands import Agent
from strands.multiagent.a2a import A2AServer
from strands_tools.calculator import calculator
import uvicorn
from fastapi import FastAPI

logging.basicConfig(level=logging.INFO)

runtime_url = os.environ.get("AGENTCORE_RUNTIME_URL", "http://127.0.0.1:9000/")

strands_agent = Agent(
    name="Calculator Agent",
    description="Performs arithmetic operations and mathematical analysis.",
    tools=[calculator],
    callback_handler=None
)

a2a_server = A2AServer(
    agent=strands_agent,
    http_url=runtime_url,
    serve_at_root=True
)

app = FastAPI()

@app.get("/ping")
def ping():
    return {"status": "healthy"}

app.mount("/", a2a_server.to_fastapi_app())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9000)
```

### Create requirements.txt

```
strands-agents[a2a]
bedrock-agentcore
strands-agents-tools
```

### Configure and launch

```bash
agentcore configure -e my_a2a_server.py --protocol A2A
agentcore launch
```

The CLI walks you through authentication setup (Amazon Cognito, Okta, or IAM) and deploys to AgentCore. On success it outputs the runtime ARN:

```
arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-a2a-server-abc123
```

### Invoke the deployed agent

After deployment, fetch the Agent Card through the AgentCore endpoint:

```bash
export AGENT_ARN="arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-a2a-server-abc123"
export BEARER_TOKEN="<your-oauth-token>"

curl -H "Authorization: Bearer $BEARER_TOKEN" \
  -H "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: $(uuidgen)" \
  "https://bedrock-agentcore.us-west-2.amazonaws.com/runtimes/$(python -c 'import urllib.parse; print(urllib.parse.quote(\"'$AGENT_ARN'\", safe=\"\"))')/invocations/.well-known/agent-card.json" | jq .
```

## IAM and security

Bedrock AgentCore supports two authentication modes:

- **OAuth 2.0**: Integrate with Amazon Cognito, Microsoft Entra ID, Okta, Google, or GitHub. Tokens are passed in the `Authorization: Bearer` header.
- **SigV4**: Standard AWS IAM request signing for service-to-service calls within your AWS account.

For agent-to-agent calls within your infrastructure, use SigV4 with an IAM role scoped to `bedrock-agentcore:InvokeRuntime`:

```json
{
  "Effect": "Allow",
  "Action": "bedrock-agentcore:InvokeRuntime",
  "Resource": "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/*"
}
```

Every AgentCore session runs in an isolated microVM, so agents cannot access each other's memory or state.

## Reference implementation

The [sample-agentic-frameworks-on-aws](https://github.com/aws-samples/sample-agentic-frameworks-on-aws) repository (234 stars) demonstrates production-grade multi-agent systems using Bedrock AgentCore and A2A. It includes a monitoring agent built with Strands SDK that analyzes CloudWatch logs and an operations orchestrator that coordinates incident response through A2A protocol calls.

Use it as a starting point for building real multi-agent workflows on AWS.

## Next steps

- Add streaming support by setting `streaming=True` in your `A2AServer` capabilities and using `message/stream` instead of `message/send`.
- Use the [A2A Inspector](https://github.com/a2aproject/a2a-inspector) to debug protocol-level issues with your deployed agents.
- Explore push notifications for long-running tasks where the client does not want to hold an open connection.
