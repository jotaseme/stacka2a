---
title: "A2A TypeScript SDK: Server and Client Examples"
description: "Build A2A agents and clients in TypeScript. Server setup with Express and Hono, client usage, streaming with ReadableStream, type safety with the protocol types."
date: "2026-02-28"
readingTime: 10
tags: ["a2a", "typescript", "sdk", "tutorial"]
relatedStacks: []
---

The A2A protocol is language-agnostic. If you can serve HTTP and parse JSON, you can build an A2A agent. TypeScript is a natural fit — JSON-based protocol, clean type mappings, and mature HTTP libraries on both sides.

This guide covers building A2A servers and clients in TypeScript with full type safety.

## Installation

```bash
npm install a2a-sdk
```

For server development, pick a framework:

```bash
# Express
npm install express @types/express a2a-sdk

# Hono (recommended for edge/Bun/Deno)
npm install hono a2a-sdk
```

## A2A types

The SDK exports types that mirror the protocol schema:

```typescript
import type {
  AgentCard, AgentSkill, AgentCapabilities,
  Task, TaskStatus, TaskState,
  Message, Part, TextPart,
  TaskStatusUpdateEvent, TaskArtifactUpdateEvent,
} from "a2a-sdk";
```

Compile-time safety for every protocol message. No guessing field names.

## Server with Express

```typescript
// server.ts
import express from "express";
import type { AgentCard, Task, Message } from "a2a-sdk";

const app = express();
app.use(express.json());

const tasks = new Map<string, Task>();

const agentCard: AgentCard = {
  name: "TypeScript Calculator",
  description: "Evaluates mathematical expressions. Supports arithmetic, percentages, and conversions.",
  url: "http://localhost:3000",
  version: "1.0.0",
  capabilities: { streaming: true, pushNotifications: false },
  skills: [{
    id: "calculate", name: "Calculate",
    description: "Evaluates a mathematical expression and returns the result.",
    tags: ["math", "calculation"],
    examples: ["What is 15% of 230?", "Calculate 2^10"],
  }],
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
};

app.get("/.well-known/agent-card.json", (_req, res) => res.json(agentCard));

function processMessage(text: string): string {
  try {
    const sanitized = text.replace(/[^0-9+\-*/().%^ ]/g, "");
    if (!sanitized.trim()) return "Send a mathematical expression.";
    const result = Function(`"use strict"; return (${sanitized})`)();
    return `Result: ${result}`;
  } catch {
    return `Could not evaluate: "${text}".`;
  }
}

app.post("/", (req, res) => {
  const { method, id, params } = req.body;

  if (method === "message/send") {
    const userText = (params.message.parts?.[0] as any)?.text ?? "";
    const taskId = crypto.randomUUID();
    const contextId = params.contextId ?? crypto.randomUUID();

    const task: Task = {
      id: taskId, contextId,
      status: {
        state: "completed",
        message: { role: "agent", parts: [{ kind: "text", text: processMessage(userText) }] },
      },
    };
    tasks.set(taskId, task);
    return res.json({ jsonrpc: "2.0", id, result: task });
  }

  if (method === "message/stream") {
    const userText = (params.message.parts?.[0] as any)?.text ?? "";
    const taskId = crypto.randomUUID();
    const contextId = params.contextId ?? crypto.randomUUID();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    res.write(`data: ${JSON.stringify({
      jsonrpc: "2.0", id,
      result: { id: taskId, contextId, status: { state: "working" } },
    })}\n\n`);

    setTimeout(() => {
      res.write(`data: ${JSON.stringify({
        jsonrpc: "2.0", id,
        result: {
          id: taskId, contextId,
          status: {
            state: "completed",
            message: { role: "agent", parts: [{ kind: "text", text: processMessage(userText) }] },
          },
        },
      })}\n\n`);
      res.end();
    }, 500);
    return;
  }

  res.status(400).json({
    jsonrpc: "2.0", id,
    error: { code: -32601, message: `Unknown method: ${method}` },
  });
});

app.listen(3000, () => {
  console.log("A2A agent running at http://localhost:3000");
});
```

```bash
npx tsx server.ts
```

## Server with Hono

Hono is lighter, runs everywhere (Node, Bun, Deno, Cloudflare Workers), and has built-in SSE:

```typescript
// server-hono.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const app = new Hono();

const agentCard = {
  name: "Hono A2A Agent",
  description: "A lightweight A2A agent running on Hono.",
  url: "http://localhost:3000",
  version: "1.0.0",
  capabilities: { streaming: true, pushNotifications: false },
  skills: [{
    id: "echo", name: "Echo",
    description: "Echoes your message back with metadata.",
    tags: ["utility"],
  }],
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
};

app.get("/.well-known/agent-card.json", (c) => c.json(agentCard));

app.post("/", async (c) => {
  const { method, id, params } = await c.req.json();

  if (method === "message/send") {
    const text = params.message.parts?.[0]?.text ?? "";
    return c.json({
      jsonrpc: "2.0", id,
      result: {
        id: crypto.randomUUID(),
        contextId: params.contextId ?? crypto.randomUUID(),
        status: {
          state: "completed",
          message: {
            role: "agent",
            parts: [{ kind: "text", text: `Echo: ${text} (${new Date().toISOString()})` }],
          },
        },
      },
    });
  }

  if (method === "message/stream") {
    const text = params.message.parts?.[0]?.text ?? "";
    const taskId = crypto.randomUUID();
    const contextId = params.contextId ?? crypto.randomUUID();

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        data: JSON.stringify({
          jsonrpc: "2.0", id,
          result: { id: taskId, contextId, status: { state: "working" } },
        }),
      });
      await stream.sleep(300);
      await stream.writeSSE({
        data: JSON.stringify({
          jsonrpc: "2.0", id,
          result: {
            id: taskId, contextId,
            status: {
              state: "completed",
              message: { role: "agent", parts: [{ kind: "text", text: `Echo: ${text}` }] },
            },
          },
        }),
      });
    });
  }

  return c.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } }, 400);
});

export default { port: 3000, fetch: app.fetch };
```

```bash
bun run server-hono.ts
```

## TypeScript client

```typescript
// client.ts
class A2AClient {
  constructor(private baseUrl: string) {}

  async getAgentCard() {
    const res = await fetch(`${this.baseUrl}/.well-known/agent-card.json`);
    if (!res.ok) throw new Error(`Failed to fetch agent card: ${res.status}`);
    return res.json();
  }

  async sendMessage(text: string, contextId?: string) {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: crypto.randomUUID(),
        method: "message/send",
        params: {
          contextId,
          message: { role: "user", parts: [{ kind: "text", text }] },
        },
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`A2A error: ${data.error.message}`);
    return data.result;
  }

  async *streamMessage(text: string, contextId?: string): AsyncGenerator<any> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: crypto.randomUUID(),
        method: "message/stream",
        params: {
          contextId,
          message: { role: "user", parts: [{ kind: "text", text }] },
        },
      }),
    });

    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6).trim()).result;
          } catch { /* skip malformed */ }
        }
      }
    }
  }
}

// Usage
const client = new A2AClient("http://localhost:3000");
const card = await client.getAgentCard();
console.log(`Agent: ${card.name} (${card.skills.length} skills)`);

const task = await client.sendMessage("What is 42 * 17?");
console.log(`Result: ${task.status.message.parts[0].text}`);

for await (const update of client.streamMessage("Calculate 2^32")) {
  console.log(`[${update.status.state}]`, update.status.message?.parts[0]?.text ?? "");
}
```

## Type-safe message construction

Build helpers that enforce the A2A message structure at compile time:

```typescript
interface TextPart { kind: "text"; text: string }
interface FilePart { kind: "file"; file: { uri: string; name?: string; mimeType?: string } }
interface DataPart { kind: "data"; data: Record<string, unknown>; mimeType?: string }
type Part = TextPart | FilePart | DataPart;

interface A2AMessage {
  role: "user" | "agent";
  parts: Part[];
}

function createTextMessage(text: string): A2AMessage {
  return { role: "user", parts: [{ kind: "text", text }] };
}

function createMultiPartMessage(parts: Part[]): A2AMessage {
  return { role: "user", parts };
}

// The compiler catches type mistakes
const msg = createMultiPartMessage([
  { kind: "text", text: "Analyze this file:" },
  { kind: "file", file: { uri: "https://example.com/data.csv", mimeType: "text/csv" } },
  { kind: "data", data: { format: "summary", maxLength: 500 }, mimeType: "application/json" },
]);
```

## Agent Card validation with Zod

```typescript
import { z } from "zod";

const AgentCardSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  url: z.string().url(),
  capabilities: z.object({
    streaming: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    extendedAgentCard: z.boolean().optional(),
  }).optional(),
  skills: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string()).optional(),
    examples: z.array(z.string()).optional(),
  })).min(1),
});

async function discoverAndValidate(url: string) {
  const res = await fetch(`${url}/.well-known/agent-card.json`);
  const result = AgentCardSchema.safeParse(await res.json());
  if (!result.success) {
    console.error("Invalid agent card:", result.error.issues);
    throw new Error("Agent card validation failed");
  }
  return result.data;
}
```

## Next steps

- [A2A Python SDK Guide](/blog/a2a-python-sdk-guide) — the Python equivalent
- [Deploy to Production](/blog/deploy-a2a-agent-production) — Docker, HTTPS, health checks
- [Agent Card Reference](/blog/a2a-agent-card-json-schema) — every field documented
- Browse the [agent directory](/agents) to find agents to integrate with
- See what [framework stacks](/stacks) are available
