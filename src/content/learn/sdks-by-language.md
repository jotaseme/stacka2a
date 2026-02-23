---
title: "A2A SDKs by Language"
description: "Installation, setup, and working examples for every A2A SDK: Python, TypeScript, Java, Go, and C#."
readingTime: 16
order: 3
icon: "code"
---

The A2A protocol is language-agnostic — it is HTTP plus JSON-RPC — but a good SDK saves you from hand-rolling Agent Card schemas, task lifecycle state machines, and SSE streaming plumbing. This guide walks through every production-ready A2A SDK: installation, server setup, client usage, streaming, and Agent Card creation. Each section is self-contained, so jump straight to your language.

## SDK landscape at a glance

Before diving into code, here is where each SDK stands in terms of feature coverage and maintenance status.

| Feature | Python | TypeScript | Java (Spring) | Go | C# (.NET) |
|---|---|---|---|---|---|
| **Maintainer** | Google (official) | Google (official) | Community (Spring AI) | Community | Community |
| **Package** | `a2a-sdk` | `@anthropic-ai/a2a-sdk` / `a2a-sdk` | `spring-ai-a2a` | `github.com/a2a-go/a2a` | `A2A.Net` |
| **Agent Card serving** | Yes | Yes | Yes | Yes | Yes |
| **`message/send`** | Yes | Yes | Yes | Yes | Yes |
| **`message/stream` (SSE)** | Yes | Yes | Yes | Yes | Yes |
| **Push notifications** | Yes | Yes | Partial | Partial | Partial |
| **Multi-turn tasks** | Yes | Yes | Yes | Yes | Yes |
| **File/artifact support** | Yes | Yes | Yes | Yes | Yes |
| **Auth (OAuth2/API key)** | Yes | Yes | Yes (Spring Security) | Manual | Yes (ASP.NET) |
| **Framework integration** | ADK, LangGraph, CrewAI | LangChain.js | Spring AI | — | Semantic Kernel |
| **Maturity** | Production | Production | Beta | Beta | Beta |

The Python and TypeScript SDKs are the reference implementations maintained by Google. Java, Go, and C# are community-driven but follow the same protocol spec and pass the A2A conformance test suite.

---

## Python

Python has the most mature A2A SDK. It is the reference implementation, maintained by Google, and the first to get new protocol features. If you are prototyping or building production agents, Python is the safest bet.

### Installation

```bash
pip install a2a-sdk
```

For Google ADK integration, install with the A2A extra:

```bash
pip install "google-adk[a2a]"
```

You need Python 3.10 or higher.

### Creating an A2A server

The SDK provides an `A2AServer` class that handles JSON-RPC routing, Agent Card serving, and SSE streaming. You supply a task handler that processes incoming messages.

```python
# server.py
from a2a.server import A2AServer
from a2a.types import AgentCard, AgentSkill, TaskHandler, SendTaskRequest, SendTaskResponse
from a2a.types import Task, TaskState, Message, TextPart, Role

class MyTaskHandler(TaskHandler):
    async def on_send_task(self, request: SendTaskRequest) -> SendTaskResponse:
        user_message = request.params.message.parts[0].text
        response_text = f"Echo: {user_message}"

        task = Task(
            id=request.params.id,
            status={"state": TaskState.COMPLETED},
            artifacts=[{
                "parts": [{"type": "text", "text": response_text}]
            }]
        )
        return SendTaskResponse(id=request.id, result=task)

agent_card = AgentCard(
    name="Echo Agent",
    description="Echoes back whatever you send",
    url="http://localhost:8000",
    version="1.0.0",
    capabilities={"streaming": True},
    skills=[AgentSkill(
        id="echo",
        name="Echo",
        description="Echoes text back to the caller"
    )]
)

server = A2AServer(agent_card=agent_card, task_handler=MyTaskHandler())
server.run(port=8000)
```

Run it:

```bash
python server.py
```

Your agent is now live at `http://localhost:8000` with the Agent Card at `/.well-known/agent-card.json`.

### Creating a client

```python
# client.py
from a2a.client import A2AClient
import asyncio

async def main():
    client = A2AClient(url="http://localhost:8000")

    # Fetch the agent card
    card = await client.get_agent_card()
    print(f"Connected to: {card.name}")
    print(f"Skills: {[s.name for s in card.skills]}")

    # Send a message
    response = await client.send_task(
        task_id="task-001",
        message={
            "role": "user",
            "parts": [{"type": "text", "text": "Hello, A2A!"}]
        }
    )
    print(f"Response: {response.artifacts[0].parts[0].text}")

asyncio.run(main())
```

### Streaming

The SDK handles SSE streaming on both server and client sides. On the server, yield events from your handler:

```python
from a2a.types import StreamTaskHandler, SendTaskStreamingRequest
from a2a.types import TaskStatusUpdate, TaskArtifactUpdate, TaskState

class MyStreamHandler(StreamTaskHandler):
    async def on_send_task_stream(self, request: SendTaskStreamingRequest):
        # Send a "working" status
        yield TaskStatusUpdate(
            id=request.params.id,
            status={"state": TaskState.WORKING, "message": "Processing..."}
        )

        # Stream the response in chunks
        words = ["This", "is", "a", "streamed", "response."]
        for i, word in enumerate(words):
            yield TaskArtifactUpdate(
                id=request.params.id,
                artifact={
                    "parts": [{"type": "text", "text": " ".join(words[:i+1])}],
                    "index": 0,
                    "append": False
                }
            )

        # Mark the task as completed
        yield TaskStatusUpdate(
            id=request.params.id,
            status={"state": TaskState.COMPLETED}
        )
```

On the client side, consume the stream:

```python
async def stream_example():
    client = A2AClient(url="http://localhost:8000")

    async for event in client.send_task_stream(
        task_id="task-002",
        message={
            "role": "user",
            "parts": [{"type": "text", "text": "Stream me a response"}]
        }
    ):
        if hasattr(event, "status"):
            print(f"Status: {event.status.state}")
        if hasattr(event, "artifact"):
            print(f"Artifact: {event.artifact.parts[0].text}")
```

### Agent Card construction

Agent Cards describe your agent to the outside world. The Python SDK gives you typed dataclasses for every field:

```python
from a2a.types import AgentCard, AgentSkill, AgentCapabilities, AuthConfig

card = AgentCard(
    name="Research Assistant",
    description="Summarizes topics and answers research questions",
    url="https://research-agent.example.com",
    version="2.1.0",
    documentationUrl="https://docs.example.com/research-agent",
    capabilities=AgentCapabilities(
        streaming=True,
        pushNotifications=True,
        stateTransitionHistory=True
    ),
    skills=[
        AgentSkill(
            id="summarize",
            name="Summarize Topic",
            description="Provides a structured summary of any topic",
            tags=["research", "summary", "analysis"],
            examples=["Summarize the history of quantum computing"]
        ),
        AgentSkill(
            id="fact-check",
            name="Fact Check",
            description="Verifies claims against known sources",
            tags=["research", "verification"]
        )
    ],
    authentication=AuthConfig(
        schemes=["bearer"],
        credentials="https://auth.example.com/.well-known/openid-configuration"
    )
)
```

### Google ADK integration

If you use Google's Agent Development Kit, you get A2A with a single function call. See the [full ADK tutorial](/blog/build-a2a-agent-google-adk) for a complete walkthrough.

```python
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

agent = Agent(
    model="gemini-2.0-flash",
    name="research_assistant",
    description="A research assistant that answers questions",
    instruction="You are a helpful research assistant."
)

# One line: wraps the agent as a full A2A server
a2a_app = to_a2a(agent, port=8001)
```

`to_a2a()` auto-generates the Agent Card from your agent metadata, sets up JSON-RPC handlers, and serves everything via uvicorn. Browse [Python A2A agents](/agents/language/python) on StackA2A for live examples.

---

## TypeScript / JavaScript

The TypeScript SDK is the second official SDK maintained by Google. It works in Node.js, Deno, and Bun. The type definitions are generated directly from the A2A JSON Schema, so they always match the protocol spec.

### Installation

```bash
npm install a2a-sdk
```

Or with Deno:

```bash
deno add npm:a2a-sdk
```

For projects already using the Google A2A reference client:

```bash
npm install @anthropic-ai/a2a-sdk
```

Both packages implement the same protocol. Pick whichever aligns with your existing dependencies.

### Creating an A2A server

```typescript
// server.ts
import { A2AServer, TaskHandler } from "a2a-sdk";
import type { AgentCard, SendTaskRequest, Task } from "a2a-sdk";

const agentCard: AgentCard = {
  name: "Echo Agent",
  description: "Echoes back whatever you send",
  url: "http://localhost:3000",
  version: "1.0.0",
  capabilities: { streaming: true },
  skills: [
    {
      id: "echo",
      name: "Echo",
      description: "Echoes text back to the caller",
    },
  ],
};

const handler: TaskHandler = {
  async onSendTask(request: SendTaskRequest): Promise<Task> {
    const userText = request.params.message.parts[0].text;
    return {
      id: request.params.id,
      status: { state: "completed" },
      artifacts: [
        {
          parts: [{ type: "text", text: `Echo: ${userText}` }],
        },
      ],
    };
  },
};

const server = new A2AServer({ agentCard, handler });
server.listen(3000, () => {
  console.log("A2A agent running on http://localhost:3000");
});
```

The server sets up Express (or the native HTTP module) under the hood, routes JSON-RPC calls, and serves the Agent Card at `/.well-known/agent-card.json`.

### Creating a client

```typescript
// client.ts
import { A2AClient } from "a2a-sdk";

async function main() {
  const client = new A2AClient("http://localhost:3000");

  // Fetch the agent card
  const card = await client.getAgentCard();
  console.log(`Connected to: ${card.name}`);
  console.log(`Skills: ${card.skills.map((s) => s.name).join(", ")}`);

  // Send a message
  const task = await client.sendTask({
    id: "task-001",
    message: {
      role: "user",
      parts: [{ type: "text", text: "Hello from TypeScript!" }],
    },
  });

  console.log(`Response: ${task.artifacts?.[0]?.parts[0]?.text}`);
}

main();
```

### Streaming with ReadableStream

The TypeScript SDK uses the native `ReadableStream` API for streaming, which works across Node.js 18+, Deno, and modern browsers.

Server-side streaming handler:

```typescript
import type { StreamTaskHandler, TaskEvent } from "a2a-sdk";

const streamHandler: StreamTaskHandler = {
  async *onSendTaskStream(request): AsyncGenerator<TaskEvent> {
    yield {
      type: "status",
      id: request.params.id,
      status: { state: "working", message: "Processing..." },
    };

    const words = ["Streaming", "response", "from", "TypeScript."];
    for (let i = 0; i < words.length; i++) {
      yield {
        type: "artifact",
        id: request.params.id,
        artifact: {
          parts: [{ type: "text", text: words.slice(0, i + 1).join(" ") }],
          index: 0,
          append: false,
        },
      };
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    yield {
      type: "status",
      id: request.params.id,
      status: { state: "completed" },
    };
  },
};
```

Client-side stream consumption:

```typescript
async function streamExample() {
  const client = new A2AClient("http://localhost:3000");

  const stream = client.sendTaskStream({
    id: "task-002",
    message: {
      role: "user",
      parts: [{ type: "text", text: "Stream me a response" }],
    },
  });

  for await (const event of stream) {
    if (event.type === "status") {
      console.log(`Status: ${event.status.state}`);
    }
    if (event.type === "artifact") {
      console.log(`Artifact: ${event.artifact.parts[0].text}`);
    }
  }
}
```

### Deno example

Deno works out of the box with no config changes. The import path is identical:

```typescript
// server.ts (Deno)
import { A2AServer } from "npm:a2a-sdk";

// ... same code as Node.js, no changes needed
```

Run with:

```bash
deno run --allow-net server.ts
```

Browse [TypeScript A2A agents](/agents/language/typescript) on StackA2A for more examples.

---

## Java (Spring Boot)

The Java A2A SDK is built on top of Spring AI and follows Spring Boot conventions: auto-configuration, dependency injection, annotation-based tool binding. It is community-maintained by the Spring AI community and tracks the latest A2A spec.

For a complete tutorial, see [Build an A2A Agent with Spring Boot](/blog/build-a2a-agent-spring-boot).

### Maven setup

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springaicommunity</groupId>
        <artifactId>spring-ai-a2a-server-autoconfigure</artifactId>
        <version>0.2.0</version>
    </dependency>
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-starter-model-openai</artifactId>
    </dependency>
</dependencies>
```

### Gradle setup

```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springaicommunity:spring-ai-a2a-server-autoconfigure:0.2.0")
    implementation("org.springframework.ai:spring-ai-starter-model-openai")
}
```

### A2A server with Spring Boot

Configure the agent card in `application.yml`:

```yaml
spring:
  ai:
    a2a:
      agent-card:
        name: "Weather Agent"
        description: "Provides weather information for any location"
        version: "1.0.0"
        capabilities:
          streaming: true
        skills:
          - id: get-weather
            name: Get Weather
            description: Gets current weather for a city
            tags:
              - weather
              - forecast
    openai:
      api-key: ${OPENAI_API_KEY}
      chat:
        options:
          model: gpt-4o
```

Create the application:

```java
// WeatherAgentApplication.java
package com.example.weather;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.tool.annotation.Tool;

@SpringBootApplication
public class WeatherAgentApplication {

    public static void main(String[] args) {
        SpringApplication.run(WeatherAgentApplication.class, args);
    }

    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder
            .defaultSystem("You are a weather assistant. Use the weather tool.")
            .defaultTools(new WeatherTools())
            .build();
    }
}
```

Define tools with Spring AI annotations:

```java
// WeatherTools.java
package com.example.weather;

import org.springframework.ai.tool.annotation.Tool;

public class WeatherTools {

    @Tool(description = "Gets the current weather for a given city")
    public String getWeather(String city) {
        // Replace with a real weather API call
        return String.format("Weather in %s: 22C, partly cloudy", city);
    }
}
```

The `spring-ai-a2a-server-autoconfigure` dependency automatically registers the JSON-RPC endpoints at `/` and serves the Agent Card at `/.well-known/agent-card.json`. No controller code needed.

### Java A2A client

```java
// A2AClientExample.java
import org.springaicommunity.a2a.client.A2AClient;
import org.springaicommunity.a2a.client.model.*;

public class A2AClientExample {

    public static void main(String[] args) throws Exception {
        A2AClient client = A2AClient.builder()
            .baseUrl("http://localhost:8080")
            .build();

        // Fetch agent card
        AgentCard card = client.getAgentCard();
        System.out.println("Agent: " + card.getName());

        // Send a task
        SendTaskRequest request = SendTaskRequest.builder()
            .id("task-001")
            .message(Message.builder()
                .role(Role.USER)
                .parts(List.of(TextPart.of("What is the weather in Tokyo?")))
                .build())
            .build();

        Task task = client.sendTask(request);
        System.out.println("Response: " +
            task.getArtifacts().get(0).getParts().get(0).getText());
    }
}
```

### Streaming in Java

```java
Flux<TaskEvent> stream = client.sendTaskStream(
    SendTaskStreamingRequest.builder()
        .id("task-002")
        .message(Message.builder()
            .role(Role.USER)
            .parts(List.of(TextPart.of("Give me a forecast")))
            .build())
        .build()
);

stream.subscribe(event -> {
    if (event instanceof TaskStatusUpdate status) {
        System.out.println("Status: " + status.getState());
    } else if (event instanceof TaskArtifactUpdate artifact) {
        System.out.println("Artifact: " + artifact.getParts().get(0).getText());
    }
});
```

Spring Boot's `Flux` from Project Reactor handles SSE streaming natively. No extra dependencies needed.

---

## Go

The Go A2A SDK is community-maintained and designed for high-throughput scenarios. It uses Go's standard `net/http` package with no external framework dependencies.

### Installation

```bash
go get github.com/a2a-go/a2a@latest
```

Requires Go 1.21 or higher.

### A2A server in Go

```go
// main.go
package main

import (
    "context"
    "fmt"
    "log"
    "net/http"

    "github.com/a2a-go/a2a"
)

type EchoHandler struct{}

func (h *EchoHandler) HandleSendTask(ctx context.Context, req *a2a.SendTaskRequest) (*a2a.Task, error) {
    userText := req.Params.Message.Parts[0].Text

    return &a2a.Task{
        ID: req.Params.ID,
        Status: a2a.TaskStatus{State: a2a.TaskStateCompleted},
        Artifacts: []a2a.Artifact{
            {
                Parts: []a2a.Part{
                    {Type: "text", Text: fmt.Sprintf("Echo: %s", userText)},
                },
            },
        },
    }, nil
}

func main() {
    card := a2a.AgentCard{
        Name:        "Echo Agent",
        Description: "Echoes back whatever you send",
        URL:         "http://localhost:8080",
        Version:     "1.0.0",
        Capabilities: a2a.Capabilities{
            Streaming: true,
        },
        Skills: []a2a.Skill{
            {
                ID:          "echo",
                Name:        "Echo",
                Description: "Echoes text back to the caller",
            },
        },
    }

    server := a2a.NewServer(card, &EchoHandler{})
    log.Println("A2A agent running on :8080")
    log.Fatal(http.ListenAndServe(":8080", server))
}
```

The `a2a.NewServer` returns a standard `http.Handler`, so it slots into any Go HTTP stack: raw `net/http`, Chi, Gin, or whatever you prefer.

### Go client

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/a2a-go/a2a"
)

func main() {
    client := a2a.NewClient("http://localhost:8080")

    // Fetch agent card
    card, err := client.GetAgentCard(context.Background())
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Connected to: %s\n", card.Name)

    // Send a task
    task, err := client.SendTask(context.Background(), &a2a.SendTaskParams{
        ID: "task-001",
        Message: a2a.Message{
            Role: "user",
            Parts: []a2a.Part{
                {Type: "text", Text: "Hello from Go!"},
            },
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Response: %s\n", task.Artifacts[0].Parts[0].Text)
}
```

### Streaming in Go

Go uses channels for streaming, which maps naturally to SSE event consumption:

Server-side streaming:

```go
func (h *EchoHandler) HandleSendTaskStream(
    ctx context.Context,
    req *a2a.SendTaskStreamingRequest,
    events chan<- a2a.TaskEvent,
) error {
    // Send working status
    events <- a2a.TaskStatusUpdate{
        ID:     req.Params.ID,
        Status: a2a.TaskStatus{State: a2a.TaskStateWorking},
    }

    words := []string{"Streaming", "from", "Go."}
    for i := range words {
        events <- a2a.TaskArtifactUpdate{
            ID: req.Params.ID,
            Artifact: a2a.Artifact{
                Parts: []a2a.Part{
                    {Type: "text", Text: strings.Join(words[:i+1], " ")},
                },
                Index: 0,
            },
        }
    }

    events <- a2a.TaskStatusUpdate{
        ID:     req.Params.ID,
        Status: a2a.TaskStatus{State: a2a.TaskStateCompleted},
    }

    return nil
}
```

Client-side stream consumption:

```go
events, err := client.SendTaskStream(ctx, &a2a.SendTaskStreamingParams{
    ID: "task-002",
    Message: a2a.Message{
        Role:  "user",
        Parts: []a2a.Part{{Type: "text", Text: "Stream me data"}},
    },
})
if err != nil {
    log.Fatal(err)
}

for event := range events {
    switch e := event.(type) {
    case *a2a.TaskStatusUpdate:
        fmt.Printf("Status: %s\n", e.Status.State)
    case *a2a.TaskArtifactUpdate:
        fmt.Printf("Artifact: %s\n", e.Artifact.Parts[0].Text)
    }
}
```

### High-performance patterns

Go excels at high-concurrency A2A scenarios. A few patterns worth adopting:

- **Connection pooling**: The default `http.Client` already pools TCP connections. For A2A servers handling hundreds of concurrent tasks, tune `MaxIdleConnsPerHost`.
- **Context propagation**: Always pass `context.Context` through your handler chain. This lets you honor client timeouts and cancellation signals cleanly.
- **Goroutine-per-task**: The Go runtime handles thousands of goroutines efficiently. Spawning one per incoming A2A task is the standard pattern.

```go
// Configure the HTTP client for high throughput
transport := &http.Transport{
    MaxIdleConnsPerHost: 100,
    IdleConnTimeout:     90 * time.Second,
}
client := a2a.NewClient("http://localhost:8080",
    a2a.WithHTTPClient(&http.Client{Transport: transport}),
)
```

---

## C# / .NET

The C# SDK targets .NET 8+ and integrates with ASP.NET Core for server-side agents. It follows .NET conventions: dependency injection, middleware pipeline, and `IAsyncEnumerable` for streaming.

### Installation

```bash
dotnet add package A2A.Net
```

Or via the NuGet Package Manager:

```powershell
Install-Package A2A.Net
```

### A2A server with ASP.NET

```csharp
// Program.cs
using A2A.Server;
using A2A.Types;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddA2AServer(options =>
{
    options.AgentCard = new AgentCard
    {
        Name = "Echo Agent",
        Description = "Echoes back whatever you send",
        Url = "http://localhost:5000",
        Version = "1.0.0",
        Capabilities = new AgentCapabilities
        {
            Streaming = true
        },
        Skills = new[]
        {
            new AgentSkill
            {
                Id = "echo",
                Name = "Echo",
                Description = "Echoes text back to the caller"
            }
        }
    };
});

builder.Services.AddSingleton<ITaskHandler, EchoTaskHandler>();

var app = builder.Build();
app.MapA2AEndpoints();
app.Run();
```

Implement the task handler:

```csharp
// EchoTaskHandler.cs
using A2A.Server;
using A2A.Types;

public class EchoTaskHandler : ITaskHandler
{
    public Task<AgentTask> HandleSendTaskAsync(
        SendTaskRequest request,
        CancellationToken ct = default)
    {
        var userText = request.Params.Message.Parts[0].Text;

        return Task.FromResult(new AgentTask
        {
            Id = request.Params.Id,
            Status = new TaskStatus { State = TaskState.Completed },
            Artifacts = new[]
            {
                new Artifact
                {
                    Parts = new[] { new TextPart { Text = $"Echo: {userText}" } }
                }
            }
        });
    }
}
```

Run it:

```bash
dotnet run
```

The `MapA2AEndpoints()` call registers the JSON-RPC route and the `/.well-known/agent-card.json` endpoint automatically.

### C# client

```csharp
// Client example
using A2A.Client;
using A2A.Types;

var client = new A2AClient("http://localhost:5000");

// Fetch agent card
var card = await client.GetAgentCardAsync();
Console.WriteLine($"Connected to: {card.Name}");

// Send a task
var task = await client.SendTaskAsync(new SendTaskParams
{
    Id = "task-001",
    Message = new Message
    {
        Role = Role.User,
        Parts = new[] { new TextPart { Text = "Hello from C#!" } }
    }
});

Console.WriteLine($"Response: {task.Artifacts[0].Parts[0].Text}");
```

### Streaming with IAsyncEnumerable

Server-side streaming handler:

```csharp
public class StreamingTaskHandler : IStreamTaskHandler
{
    public async IAsyncEnumerable<TaskEvent> HandleSendTaskStreamAsync(
        SendTaskStreamingRequest request,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        yield return new TaskStatusUpdate
        {
            Id = request.Params.Id,
            Status = new TaskStatus
            {
                State = TaskState.Working,
                Message = "Processing..."
            }
        };

        var words = new[] { "Streaming", "from", "C#." };
        for (int i = 0; i < words.Length; i++)
        {
            yield return new TaskArtifactUpdate
            {
                Id = request.Params.Id,
                Artifact = new Artifact
                {
                    Parts = new[]
                    {
                        new TextPart
                        {
                            Text = string.Join(" ", words.Take(i + 1))
                        }
                    },
                    Index = 0
                }
            };
            await Task.Delay(200, ct);
        }

        yield return new TaskStatusUpdate
        {
            Id = request.Params.Id,
            Status = new TaskStatus { State = TaskState.Completed }
        };
    }
}
```

Client-side stream consumption:

```csharp
await foreach (var evt in client.SendTaskStreamAsync(new SendTaskStreamingParams
{
    Id = "task-002",
    Message = new Message
    {
        Role = Role.User,
        Parts = new[] { new TextPart { Text = "Stream me data" } }
    }
}))
{
    switch (evt)
    {
        case TaskStatusUpdate status:
            Console.WriteLine($"Status: {status.Status.State}");
            break;
        case TaskArtifactUpdate artifact:
            Console.WriteLine($"Artifact: {artifact.Artifact.Parts[0].Text}");
            break;
    }
}
```

### Azure integration notes

The C# SDK works out of the box with Azure App Service, Azure Container Apps, and Azure Functions. A few tips:

- **Azure App Service**: Deploy like any ASP.NET Core app. The A2A endpoints register through the standard middleware pipeline.
- **Azure Container Apps**: Set the target port to match your `app.Run()` port. Container Apps handles HTTPS termination, so your Agent Card URL should use `https://`.
- **Authentication**: Use Azure Entra ID (formerly Azure AD) with the standard ASP.NET Core authentication middleware. Add the `[Authorize]` attribute to protect your A2A endpoint, or configure auth in the Agent Card's `authentication` field.
- **Semantic Kernel**: The C# SDK integrates with Microsoft Semantic Kernel. You can wrap a Semantic Kernel agent as an A2A server, exposing its plugins as A2A skills.

```csharp
// Azure Entra ID authentication example
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

builder.Services.AddA2AServer(options =>
{
    options.AgentCard = new AgentCard
    {
        // ... agent card fields
        Authentication = new AuthConfig
        {
            Schemes = new[] { "bearer" },
            Credentials = "https://login.microsoftonline.com/{tenant}/.well-known/openid-configuration"
        }
    };
    options.RequireAuthentication = true;
});
```

---

## Framework integration

The real power of A2A SDKs shows when they plug into existing agent frameworks. Here are the three most popular integrations.

### Google ADK (Python)

Google ADK is the tightest integration. The `to_a2a()` function wraps any ADK agent in a complete A2A server with zero manual configuration. It generates the Agent Card from the agent's `name`, `description`, and tool definitions. It maps ADK tool calls to A2A artifacts. It handles streaming, multi-turn state, and cancellation.

```python
from google.adk import Agent
from google.adk.a2a.utils.agent_to_a2a import to_a2a

agent = Agent(
    model="gemini-2.0-flash",
    name="data_analyst",
    description="Analyzes datasets and creates visualizations",
    instruction="You are a data analyst...",
    tools=[analyze_csv, create_chart]
)

app = to_a2a(agent, port=8001)
```

One function call. The rest is automatic. See the [Google ADK guide](/blog/build-a2a-agent-google-adk) and browse [ADK-based agents](/agents/framework/google-adk) on StackA2A.

### LangGraph (Python)

LangGraph embeds A2A directly into its platform server. Every LangGraph assistant gets an A2A endpoint at `/a2a/{assistant_id}` with zero configuration. The Agent Card is auto-generated from assistant metadata. Streaming works through LangGraph's built-in SSE support.

```python
# langgraph.json
{
  "assistants": {
    "data-analyst": {
      "graph": "agent:graph",
      "a2a": {
        "skills": [
          {
            "id": "analyze",
            "name": "Analyze Data",
            "description": "Analyzes CSV datasets"
          }
        ]
      }
    }
  }
}
```

Start the LangGraph platform server, and your agent is discoverable at `/.well-known/agent-card.json`. See the [LangGraph tutorial](/blog/build-a2a-agent-langgraph) for a complete walkthrough.

### Spring Boot (Java)

Spring AI A2A auto-configures everything from `application.yml`. Drop in the `spring-ai-a2a-server-autoconfigure` dependency, define your agent card in YAML, register a `ChatClient` bean with tools, and the auto-configuration wires up the JSON-RPC endpoints and Agent Card serving. Spring Boot's `@Tool` annotation maps directly to A2A skills.

```java
@Tool(description = "Calculates compound interest")
public String calculateInterest(double principal, double rate, int years) {
    double amount = principal * Math.pow(1 + rate / 100, years);
    return String.format("$%.2f", amount);
}
```

Each `@Tool` method becomes a callable capability that the agent can invoke during task processing. The Spring AI framework handles the tool-call loop between the LLM and your annotated methods.

---

## Choosing the right SDK

The decision comes down to three factors: what language your team writes, what framework you already use, and what maturity level you need.

### Pick Python if:

- You are building a new agent from scratch and want the most examples and community support.
- You use Google ADK, LangGraph, CrewAI, or any Python-based agent framework.
- You need every A2A feature on day one, including push notifications and file artifacts.
- Your agents interact with ML models, data pipelines, or Jupyter notebooks.

### Pick TypeScript if:

- Your backend is Node.js, Deno, or Bun.
- You want browser-compatible streaming via ReadableStream.
- You are building a full-stack application with Next.js or similar frameworks where the agent runs server-side.
- You need strong typing with generated types from the A2A JSON Schema.

### Pick Java if:

- You are in a Spring Boot shop and want native framework integration.
- Enterprise requirements demand Spring Security, Spring Actuator monitoring, and Maven/Gradle build tooling.
- Your organization already runs Spring AI for LLM integration.

### Pick Go if:

- You need maximum throughput with minimal resource usage.
- You are building infrastructure-level agents: API gateways, service mesh proxies, or orchestrators that route tasks between other agents.
- You prefer the standard library and minimal dependencies.
- You deploy to environments where binary size and startup time matter (serverless, edge).

### Pick C# if:

- Your stack is .NET and Azure.
- You use Microsoft Semantic Kernel for LLM orchestration.
- You need enterprise auth via Azure Entra ID out of the box.
- Your deployment targets are Azure App Service, Azure Container Apps, or Azure Functions.

### Cross-language interop

One of the strongest reasons for A2A is that the language of each agent does not matter. A Python agent can call a Go agent, which delegates to a Java agent, which returns results to a TypeScript frontend. The protocol is the contract, not the SDK.

A practical pattern for mixed-language teams:

1. Build compute-heavy agents in Go or Rust for throughput.
2. Build LLM-powered agents in Python for framework support.
3. Build user-facing agents in TypeScript for frontend integration.
4. Connect them all over A2A.

Every agent publishes an Agent Card. Every client fetches it. The protocol handles the rest.

---

## Agent Card interoperability

Regardless of which SDK you use, Agent Cards follow an identical JSON schema. An Agent Card created by the Python SDK is parseable by the Go client, and vice versa. This is by design — the card is a protocol-level concept, not an SDK concept.

To verify interop, test your Agent Card against the A2A JSON Schema validator:

```bash
# Fetch and validate any agent's card
curl -s http://localhost:8000/.well-known/agent-card.json | python -m a2a.validate
```

Or use the [StackA2A validator tool](/tools) to check your card in the browser.

Key fields every Agent Card must include:

- `name` — Human-readable agent name
- `url` — Base URL where the agent accepts JSON-RPC requests
- `version` — Semantic version string
- `skills` — Array of at least one skill with `id`, `name`, and `description`

Optional but recommended:

- `capabilities` — Declare streaming, push notifications, state history support
- `authentication` — Specify required auth scheme so clients can authenticate before sending tasks
- `documentationUrl` — Link to human-readable docs about your agent

Browse the full [A2A stacks directory](/stacks) to see how different teams combine these SDKs in production deployments.

---

## Next steps

You have the installation commands, server boilerplate, client examples, and streaming patterns for all five languages. From here:

- **Build your first agent** — pick the language you know best and get a server running locally. The echo server pattern in this guide works as a starting point.
- **Connect two agents** — use the client SDK in one language to call a server in another. Verify that Agent Card fetching, task sending, and streaming all work cross-language.
- **Add real logic** — replace the echo handler with an LLM call, tool invocations, or whatever your agent needs to do. The A2A protocol handles the transport; your handler holds the intelligence.
- **Deploy and discover** — publish your Agent Card at a public URL so other agents can find and call yours.

The protocol spec is open. The SDKs are open-source. Build something.
