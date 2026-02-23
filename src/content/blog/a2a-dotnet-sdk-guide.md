---
title: "A2A .NET SDK Guide: Build Enterprise Agents with C#"
description: "Complete guide to building A2A protocol agents in C# using the official .NET SDK and Semantic Kernel for enterprise-grade multi-agent systems."
date: "2026-02-23"
readingTime: 7
tags: ["a2a", "dotnet", "csharp", "semantic-kernel", "enterprise", "sdk"]
relatedStacks: ["semantic-kernel-stack"]
relatedAgents: ["a2a-semantic-kernel-dotnet", "agent2agent", "a2aprotocol-net"]
---

The [A2A .NET SDK](https://github.com/a2aproject/a2a-dotnet) is the official C# implementation of the Agent-to-Agent protocol. It provides a `TaskManager` for handling the A2A task lifecycle, an `A2AClient` for consuming remote agents, and ASP.NET Core integration via `MapA2A()` and `MapWellKnownAgentCard()` extension methods. The SDK is actively maintained and follows the latest A2A protocol specification.

This guide covers building a complete A2A agent in C#, from NuGet install to Semantic Kernel integration.

## Install the SDK

Create a new ASP.NET Core project and add the A2A package:

```bash
dotnet new web -n MyA2AAgent
cd MyA2AAgent
dotnet add package A2A
```

The `A2A` package brings in the protocol types (`AgentCard`, `AgentTask`, `TextPart`, `MessageRole`), the `TaskManager`, the `A2AClient`, and the ASP.NET Core routing extensions.

## Build a Basic A2A Agent

Here is a minimal A2A agent that echoes messages back to the caller:

```csharp
// Program.cs
using A2A;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var taskManager = new TaskManager();

// Handle incoming messages (stateless pattern)
taskManager.OnMessageReceived = async (messageSendParams, ct) =>
{
    var userText = messageSendParams.Message.Parts
        .OfType<TextPart>()
        .First()
        .Text;

    return new AgentMessage
    {
        Role = MessageRole.Agent,
        MessageId = Guid.NewGuid().ToString(),
        ContextId = messageSendParams.Message.ContextId,
        Parts = [new TextPart { Text = $"You said: {userText}" }]
    };
};

// Serve the Agent Card
taskManager.OnAgentCardQuery = async (agentUrl, ct) =>
{
    return new AgentCard
    {
        Name = "Echo Agent",
        Description = "A simple agent that echoes messages back",
        Url = agentUrl,
        Version = "1.0.0",
        DefaultInputModes = ["text"],
        DefaultOutputModes = ["text"],
        Capabilities = new AgentCapabilities
        {
            Streaming = false,
            PushNotifications = false
        },
        Skills = []
    };
};

// Map A2A endpoints
app.MapA2A(taskManager);
app.MapWellKnownAgentCard(taskManager);

app.Run();
```

Run it:

```bash
dotnet run --urls "http://localhost:5100"
```

Verify the Agent Card:

```bash
curl -s http://localhost:5100/.well-known/agent-card.json | jq .
```

Send a message:

```bash
curl -X POST http://localhost:5100/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "Hello from curl"}]
      }
    }
  }'
```

## Task Lifecycle: Long-Running Work

The echo agent above uses the stateless `OnMessageReceived` pattern -- it returns a response immediately. For long-running work, use the task-based pattern with `OnTaskCreated`:

```csharp
var taskStore = new InMemoryTaskStore();
var taskManager = new TaskManager(taskStore: taskStore);

taskManager.OnTaskCreated = async (task, ct) =>
{
    // Acknowledge the task is being worked on
    await taskManager.UpdateStatusAsync(
        task.Id,
        TaskState.Working,
        message: new AgentMessage
        {
            Role = MessageRole.Agent,
            MessageId = Guid.NewGuid().ToString(),
            Parts = [new TextPart { Text = "Processing your request..." }]
        },
        final: false,
        cancellationToken: ct
    );

    // Simulate work (replace with real logic)
    await Task.Delay(3000, ct);

    // Return the result as an artifact
    await taskManager.ReturnArtifactAsync(
        task.Id,
        new Artifact
        {
            ArtifactId = Guid.NewGuid().ToString(),
            Name = "Analysis Result",
            Parts = [new TextPart { Text = "Here is the completed analysis..." }]
        },
        ct
    );

    // Mark the task as complete
    await taskManager.UpdateStatusAsync(
        task.Id,
        TaskState.Completed,
        final: true,
        cancellationToken: ct
    );
};

taskManager.OnTaskCancelled = async (task, ct) =>
{
    Console.WriteLine($"Task {task.Id} was cancelled");
};
```

The `InMemoryTaskStore` tracks task state across status updates. For production, implement `ITaskStore` backed by a database.

## Integrate Semantic Kernel

The real power of building A2A agents in .NET comes from integrating with [Semantic Kernel](https://github.com/microsoft/semantic-kernel), Microsoft's SDK for AI orchestration. Semantic Kernel provides LLM abstraction, plugin systems, and planners that pair naturally with A2A's task model.

Install Semantic Kernel:

```bash
dotnet add package Microsoft.SemanticKernel
```

Build an agent that uses Semantic Kernel for AI processing:

```csharp
// Program.cs
using A2A;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

var builder = WebApplication.CreateBuilder(args);

// Configure Semantic Kernel
builder.Services.AddKernel()
    .AddAzureOpenAIChatCompletion(
        deploymentName: "gpt-4o",
        endpoint: builder.Configuration["AzureOpenAI:Endpoint"]!,
        apiKey: builder.Configuration["AzureOpenAI:ApiKey"]!
    );

var app = builder.Build();
var kernel = app.Services.GetRequiredService<Kernel>();

var taskManager = new TaskManager();

taskManager.OnMessageReceived = async (messageSendParams, ct) =>
{
    var userText = messageSendParams.Message.Parts
        .OfType<TextPart>()
        .First()
        .Text;

    // Use Semantic Kernel to generate a response
    var chatService = kernel.GetRequiredService<IChatCompletionService>();
    var history = new ChatHistory();
    history.AddSystemMessage(
        "You are a technical documentation assistant. "
        + "Generate clear, concise documentation for the code or API described."
    );
    history.AddUserMessage(userText);

    var response = await chatService.GetChatMessageContentAsync(
        history,
        cancellationToken: ct
    );

    return new AgentMessage
    {
        Role = MessageRole.Agent,
        MessageId = Guid.NewGuid().ToString(),
        ContextId = messageSendParams.Message.ContextId,
        Parts = [new TextPart { Text = response.Content ?? "No response generated" }]
    };
};

taskManager.OnAgentCardQuery = async (agentUrl, ct) =>
{
    return new AgentCard
    {
        Name = "Documentation Agent",
        Description = "Generates technical documentation from code and API descriptions using Azure OpenAI",
        Url = agentUrl,
        Version = "1.0.0",
        DefaultInputModes = ["text"],
        DefaultOutputModes = ["text"],
        Capabilities = new AgentCapabilities
        {
            Streaming = true,
            PushNotifications = false
        },
        Skills =
        [
            new AgentSkill
            {
                Id = "api-docs",
                Name = "API Documentation",
                Description = "Generates REST API documentation from endpoint descriptions",
                Tags = ["documentation", "api", "openapi"]
            },
            new AgentSkill
            {
                Id = "code-docs",
                Name = "Code Documentation",
                Description = "Generates inline documentation and README content from source code",
                Tags = ["documentation", "code", "readme"]
            }
        ]
    };
};

app.MapA2A(taskManager);
app.MapWellKnownAgentCard(taskManager);

app.Run();
```

## Add Semantic Kernel Plugins

Semantic Kernel plugins give your agent callable functions, similar to tools in PydanticAI or Google ADK. Define a plugin class and register it with the kernel:

```csharp
using System.ComponentModel;
using Microsoft.SemanticKernel;

public class DocumentationPlugin
{
    [KernelFunction, Description("Search existing documentation for a given topic")]
    public async Task<string> SearchDocs(
        [Description("The topic to search for")] string query)
    {
        // In production, query your documentation index
        return $"Found 3 relevant docs for: {query}";
    }

    [KernelFunction, Description("Get the OpenAPI spec for a service")]
    public async Task<string> GetOpenApiSpec(
        [Description("The service name")] string serviceName)
    {
        return $"OpenAPI spec for {serviceName}: ...";
    }
}

// Register the plugin
builder.Services.AddKernel()
    .AddAzureOpenAIChatCompletion(/* ... */)
    .Plugins.AddFromType<DocumentationPlugin>();
```

Then enable automatic function calling in your agent handler:

```csharp
var executionSettings = new OpenAIPromptExecutionSettings
{
    FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
};

var response = await chatService.GetChatMessageContentAsync(
    history,
    executionSettings,
    kernel,
    ct
);
```

The LLM will call `SearchDocs` and `GetOpenApiSpec` when relevant to the user's request.

## Consume Remote A2A Agents

The SDK includes `A2AClient` for calling other A2A agents:

```csharp
using A2A;

// Discover the remote agent
var cardResolver = new A2ACardResolver(new Uri("http://remote-agent:8000/"));
var agentCard = await cardResolver.GetAgentCardAsync();

// Create a client
var client = new A2AClient(new Uri(agentCard.Url));

// Send a message
var response = await client.SendMessageAsync(new MessageSendParams
{
    Message = new AgentMessage
    {
        Role = MessageRole.User,
        MessageId = Guid.NewGuid().ToString(),
        Parts = [new TextPart { Text = "Analyze this dataset for trends" }]
    }
});

// Handle the response
if (response is AgentMessage message)
{
    var text = message.Parts.OfType<TextPart>().First().Text;
    Console.WriteLine($"Agent response: {text}");
}
else if (response is AgentTask task)
{
    Console.WriteLine($"Task created: {task.Id}, Status: {task.Status.State}");

    // Poll or subscribe for updates
    await foreach (var sseItem in client.SubscribeToTaskAsync(task.Id))
    {
        if (sseItem.Data is TaskStatusUpdateEvent statusUpdate && statusUpdate.Final)
        {
            Console.WriteLine("Task completed");
            break;
        }
    }
}
```

This makes it straightforward to build coordinator agents in C# that delegate work to specialized agents -- whether those agents are written in C#, Python, Java, or any other language that implements the A2A protocol.

## Configuration for Production

Use `appsettings.json` for environment-specific configuration:

```json
{
  "AzureOpenAI": {
    "Endpoint": "https://your-instance.openai.azure.com/",
    "ApiKey": ""
  },
  "AgentCard": {
    "Name": "Documentation Agent",
    "Version": "1.0.0",
    "Url": "https://docs-agent.your-domain.com"
  }
}
```

For containerized deployments:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["MyA2AAgent.csproj", "."]
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "MyA2AAgent.dll"]
```

The A2A .NET SDK gives you full protocol compliance with idiomatic C# patterns. Combined with Semantic Kernel's AI capabilities and ASP.NET Core's production infrastructure (logging, configuration, dependency injection, health checks), it is a strong foundation for enterprise multi-agent systems.
