import type { A2AAgent, A2ASDK } from "./types";

export function generateSnippet(agent: A2AAgent, sdk: A2ASDK): string {
  const url = agent.endpointUrl || "http://localhost:8080";

  switch (sdk) {
    case "python":
      return generatePythonSnippet(agent, url);
    case "typescript":
      return generateTypeScriptSnippet(agent, url);
    case "java":
      return generateJavaSnippet(agent, url);
    case "go":
      return generateGoSnippet(agent, url);
    case "csharp":
      return generateCSharpSnippet(agent, url);
  }
}

function generatePythonSnippet(agent: A2AAgent, url: string): string {
  return `import asyncio
from a2a.client import A2AClient

async def main():
    # Connect to ${agent.name}
    client = A2AClient(url="${url}")

    # Discover capabilities
    card = await client.get_agent_card()
    print(f"Agent: {card.name}")
    print(f"Skills: {[s.name for s in card.skills]}")

    # Send a task
    response = await client.send_message(
        message={
            "role": "user",
            "parts": [{"kind": "text", "text": "Hello from A2A client"}]
        }
    )
    print(response)

asyncio.run(main())`;
}

function generateTypeScriptSnippet(agent: A2AAgent, url: string): string {
  return `import { A2AClient } from "@a2a-js/sdk";

// Connect to ${agent.name}
const client = new A2AClient("${url}");

// Discover capabilities
const card = await fetch("${url}/.well-known/agent-card.json")
  .then(res => res.json());
console.log("Agent:", card.name);
console.log("Skills:", card.skills.map(s => s.name));

// Send a message
const response = await client.sendMessage({
  message: {
    role: "user",
    parts: [{ kind: "text", text: "Hello from A2A client" }],
  },
});
console.log(response);`;
}

function generateJavaSnippet(agent: A2AAgent, url: string): string {
  return `import com.google.a2a.client.A2AClient;
import com.google.a2a.types.*;

// Connect to ${agent.name}
A2AClient client = A2AClient.builder()
    .baseUrl("${url}")
    .build();

// Discover capabilities
AgentCard card = client.getAgentCard();
System.out.println("Agent: " + card.getName());

// Send a task
MessageSendParams params = MessageSendParams.builder()
    .message(Message.builder()
        .role("user")
        .addPart(TextPart.of("Hello from A2A client"))
        .build())
    .build();
Task task = client.sendMessage(params);
System.out.println(task);`;
}

function generateGoSnippet(agent: A2AAgent, url: string): string {
  return `package main

import (
    "context"
    "fmt"
    "log"
    a2a "github.com/a2aproject/a2a-go/client"
)

func main() {
    // Connect to ${agent.name}
    client, err := a2a.NewClient("${url}")
    if err != nil {
        log.Fatal(err)
    }

    // Discover capabilities
    card, err := client.GetAgentCard(context.Background())
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Agent: %s\\n", card.Name)

    // Send a message
    resp, err := client.SendMessage(context.Background(), &a2a.SendMessageParams{
        Message: a2a.Message{
            Role:  "user",
            Parts: []a2a.Part{{Kind: "text", Text: "Hello from A2A client"}},
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(resp)
}`;
}

function generateCSharpSnippet(agent: A2AAgent, url: string): string {
  return `using A2A.Client;
using A2A.Types;

// Connect to ${agent.name}
var client = new A2AClient("${url}");

// Discover capabilities
var card = await client.GetAgentCardAsync();
Console.WriteLine($"Agent: {card.Name}");

// Send a message
var response = await client.SendMessageAsync(new SendMessageParams
{
    Message = new Message
    {
        Role = "user",
        Parts = new[] { new TextPart("Hello from A2A client") }
    }
});
Console.WriteLine(response);`;
}

export function getSnippetLanguage(sdk: A2ASDK): string {
  switch (sdk) {
    case "python":
      return "python";
    case "typescript":
      return "typescript";
    case "java":
      return "java";
    case "go":
      return "go";
    case "csharp":
      return "csharp";
  }
}

export function getInstallCommand(sdk: A2ASDK): string {
  switch (sdk) {
    case "python":
      return "pip install a2a-sdk";
    case "typescript":
      return "npm install @a2a-js/sdk";
    case "java":
      return "// Add a2a-java to Maven/Gradle dependencies";
    case "go":
      return "go get github.com/a2aproject/a2a-go";
    case "csharp":
      return "dotnet add package A2A.Client";
  }
}
