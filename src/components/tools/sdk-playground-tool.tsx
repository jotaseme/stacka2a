"use client";

import { useState } from "react";
import type { A2ASDK } from "@/lib/types";

const sdks: { id: A2ASDK; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "typescript", label: "TypeScript" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "csharp", label: "C#" },
];

const installCommands: Record<A2ASDK, string> = {
  python: "pip install a2a-sdk",
  typescript: "npm install @a2a-js/sdk",
  java: "<!-- Add to pom.xml -->\n<dependency>\n  <groupId>com.google.a2a</groupId>\n  <artifactId>a2a-sdk-java</artifactId>\n  <version>0.2.0</version>\n</dependency>",
  go: "go get github.com/a2aproject/a2a-go",
  csharp: "dotnet add package A2A.SDK",
};

function generatePlaygroundSnippet(
  sdk: A2ASDK,
  agentUrl: string,
  message: string
): string {
  const url = agentUrl || "https://agent.example.com";
  const msg = message || "Hello, what can you do?";

  switch (sdk) {
    case "python":
      return `from a2a.client import A2AClient

async def main():
    client = A2AClient(url="${url}")

    # Discover agent capabilities
    card = await client.get_agent_card()
    print(f"Agent: {card.name}")
    print(f"Skills: {[s.name for s in card.skills]}")

    # Send a message
    response = await client.send_message(
        message={
            "role": "user",
            "parts": [{"kind": "text", "text": "${msg}"}]
        }
    )

    # Print the response
    for part in response.result.artifacts:
        print(part.parts[0].text)

import asyncio
asyncio.run(main())`;

    case "typescript":
      return `import { A2AClient } from "@a2a-js/sdk";

const client = new A2AClient("${url}");

// Discover agent capabilities
const card = await client.getAgentCard();
console.log(\`Agent: \${card.name}\`);
console.log(\`Skills: \${card.skills.map(s => s.name)}\`);

// Send a message
const response = await client.sendMessage({
  message: {
    role: "user",
    parts: [{ kind: "text", text: "${msg}" }],
  },
});

// Print the response
for (const artifact of response.result.artifacts) {
  console.log(artifact.parts[0].text);
}`;

    case "java":
      return `import com.google.a2a.client.A2AClient;
import com.google.a2a.model.*;

public class Main {
    public static void main(String[] args) throws Exception {
        var client = A2AClient.builder()
            .url("${url}")
            .build();

        // Discover agent capabilities
        AgentCard card = client.getAgentCard();
        System.out.println("Agent: " + card.getName());

        // Send a message
        var message = Message.builder()
            .role("user")
            .parts(List.of(TextPart.of("${msg}")))
            .build();

        TaskResponse response = client.sendMessage(
            SendMessageRequest.builder()
                .message(message)
                .build()
        );

        // Print the response
        for (var artifact : response.getResult().getArtifacts()) {
            System.out.println(artifact.getParts().get(0).getText());
        }
    }
}`;

    case "go":
      return `package main

import (
	"context"
	"fmt"
	"log"

	"github.com/a2aproject/a2a-go/client"
)

func main() {
	c, err := client.New("${url}")
	if err != nil {
		log.Fatal(err)
	}

	// Discover agent capabilities
	card, err := c.GetAgentCard(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Agent: %s\\n", card.Name)

	// Send a message
	resp, err := c.SendMessage(context.Background(), &client.SendMessageRequest{
		Message: client.Message{
			Role: "user",
			Parts: []client.Part{
				{Kind: "text", Text: "${msg}"},
			},
		},
	})
	if err != nil {
		log.Fatal(err)
	}

	// Print the response
	for _, artifact := range resp.Result.Artifacts {
		fmt.Println(artifact.Parts[0].Text)
	}
}`;

    case "csharp":
      return `using A2A.SDK;
using A2A.SDK.Models;

var client = new A2AClient("${url}");

// Discover agent capabilities
var card = await client.GetAgentCardAsync();
Console.WriteLine($"Agent: {card.Name}");

// Send a message
var response = await client.SendMessageAsync(new SendMessageRequest
{
    Message = new Message
    {
        Role = "user",
        Parts = new[] { new TextPart("${msg}") }
    }
});

// Print the response
foreach (var artifact in response.Result.Artifacts)
{
    Console.WriteLine(artifact.Parts[0].Text);
}`;
  }
}

export function SdkPlaygroundTool() {
  const [activeSdk, setActiveSdk] = useState<A2ASDK>("python");
  const [agentUrl, setAgentUrl] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const snippet = generatePlaygroundSnippet(activeSdk, agentUrl, message);
  const install = installCommands[activeSdk];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Inputs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            Agent URL
          </label>
          <input
            type="text"
            value={agentUrl}
            onChange={(e) => setAgentUrl(e.target.value)}
            placeholder="https://agent.example.com"
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            Message
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hello, what can you do?"
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* SDK Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {sdks.map((sdk) => (
          <button
            key={sdk.id}
            onClick={() => setActiveSdk(sdk.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeSdk === sdk.id
                ? "bg-background text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {sdk.label}
          </button>
        ))}
      </div>

      {/* Install command */}
      <div className="rounded-xl bg-surface border border-border px-4 py-2.5 font-mono text-sm text-text-secondary">
        <span className="text-accent select-none">$ </span>
        {install.includes("\n") ? (
          <pre className="mt-1 whitespace-pre-wrap">{install}</pre>
        ) : (
          install
        )}
      </div>

      {/* Code snippet */}
      <div className="relative rounded-xl bg-code-bg border border-[#2a2a2a] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2">
          <span className="text-xs text-code-text/50">
            {activeSdk === "csharp" ? "C#" : activeSdk}
          </span>
          <button
            onClick={handleCopy}
            className="text-xs text-code-text/50 hover:text-code-text transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-code-text font-mono">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  );
}
