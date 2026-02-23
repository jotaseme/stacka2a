---
title: "A2A + Kubernetes: Deploying Agents at Scale"
description: "Learn how to deploy A2A protocol agents on Kubernetes with auto-scaling, service discovery, and health checks for production multi-agent systems."
date: "2026-02-23"
readingTime: 8
tags: ["a2a", "kubernetes", "deployment", "scaling", "production"]
relatedStacks: ["google-adk-stack", "multi-agent"]
relatedAgents: ["a2a-sample-adk-cloud-run", "sample-agentic-frameworks-on-aws"]
---

A2A agents are HTTP servers. Kubernetes runs HTTP servers at scale. The combination is natural, but the details matter -- agent card serving, inter-agent DNS discovery, task queue autoscaling, and graceful shutdowns all require specific configuration.

This guide walks through deploying A2A agents on Kubernetes with production-ready patterns.

## Why Kubernetes for A2A Agents

A2A agents communicate over HTTP using JSON-RPC. Each agent is a standalone server that serves an Agent Card at `/.well-known/agent-card.json` and accepts task requests at its root endpoint. This maps cleanly to Kubernetes primitives:

- **Pods** run individual agent instances
- **Services** provide stable DNS names for agent-to-agent discovery
- **ConfigMaps** store agent card metadata separately from code
- **HPA** scales agents based on task queue depth
- **Liveness/readiness probes** use the agent card endpoint as a health check

A multi-agent system with 5-10 agents, each needing independent scaling and failure isolation, is exactly the workload Kubernetes was designed for.

## Deployment Manifest

Here is a complete Deployment for an A2A agent built with any Python framework (PydanticAI, Google ADK, LangGraph):

```yaml
# k8s/agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: research-agent
  labels:
    app: research-agent
    protocol: a2a
spec:
  replicas: 2
  selector:
    matchLabels:
      app: research-agent
  template:
    metadata:
      labels:
        app: research-agent
        protocol: a2a
    spec:
      containers:
        - name: agent
          image: ghcr.io/your-org/research-agent:1.2.0
          ports:
            - containerPort: 8000
              name: a2a
          env:
            - name: AGENT_URL
              value: "http://research-agent.agents.svc.cluster.local:8000"
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: llm-credentials
                  key: openai-api-key
          envFrom:
            - configMapRef:
                name: research-agent-config
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          livenessProbe:
            httpGet:
              path: /.well-known/agent-card.json
              port: a2a
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /.well-known/agent-card.json
              port: a2a
            initialDelaySeconds: 5
            periodSeconds: 10
          startupProbe:
            httpGet:
              path: /.well-known/agent-card.json
              port: a2a
            failureThreshold: 30
            periodSeconds: 2
```

Key decisions here: the `AGENT_URL` environment variable tells the agent its own resolvable address within the cluster, which gets embedded in the Agent Card's `url` field. The agent card endpoint doubles as both liveness and readiness probe -- if the agent can serve its card, it can accept tasks. The startup probe gives the agent up to 60 seconds to load models or warm caches before Kubernetes considers it failed.

## Service and DNS Discovery

Expose each agent as a ClusterIP Service:

```yaml
# k8s/agent-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: research-agent
  namespace: agents
  labels:
    app: research-agent
    protocol: a2a
spec:
  selector:
    app: research-agent
  ports:
    - port: 8000
      targetPort: a2a
      protocol: TCP
      name: a2a
  type: ClusterIP
```

With this setup, any agent in the `agents` namespace can discover the research agent at `http://research-agent.agents.svc.cluster.local:8000`. A coordinator agent discovers peers by fetching their Agent Cards through DNS:

```python
import httpx

AGENT_REGISTRY = {
    "research": "http://research-agent.agents.svc.cluster.local:8000",
    "code-review": "http://code-review-agent.agents.svc.cluster.local:8000",
    "data-analysis": "http://data-analysis-agent.agents.svc.cluster.local:8000",
}

async def discover_agents() -> dict:
    """Fetch agent cards from all registered agents."""
    cards = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, url in AGENT_REGISTRY.items():
            resp = await client.get(f"{url}/.well-known/agent-card.json")
            if resp.status_code == 200:
                cards[name] = resp.json()
    return cards
```

For dynamic discovery without hardcoding URLs, label your Services with `protocol: a2a` and use the Kubernetes API to list them:

```python
from kubernetes import client, config

config.load_incluster_config()
v1 = client.CoreV1Api()

services = v1.list_namespaced_service(
    namespace="agents",
    label_selector="protocol=a2a"
)
agent_urls = [
    f"http://{svc.metadata.name}.agents.svc.cluster.local:{svc.spec.ports[0].port}"
    for svc in services.items
]
```

## Agent Card via ConfigMap

Separating the Agent Card from your application code lets you update metadata without rebuilding images:

```yaml
# k8s/agent-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: research-agent-config
  namespace: agents
data:
  AGENT_NAME: "Research Assistant"
  AGENT_DESCRIPTION: "AI research agent for topic summarization and comparative analysis"
  AGENT_VERSION: "1.2.0"
  AGENT_SKILLS: >
    [
      {
        "id": "summarize",
        "name": "Topic Summarization",
        "description": "Summarizes any topic with key facts and context"
      },
      {
        "id": "compare",
        "name": "Comparative Analysis",
        "description": "Compares technologies or approaches with pros and cons"
      }
    ]
```

Your agent reads these at startup and constructs the Agent Card dynamically:

```python
import os
import json

def build_agent_card() -> dict:
    return {
        "name": os.environ["AGENT_NAME"],
        "description": os.environ["AGENT_DESCRIPTION"],
        "version": os.environ["AGENT_VERSION"],
        "url": os.environ["AGENT_URL"],
        "capabilities": {"streaming": True, "pushNotifications": False},
        "defaultInputModes": ["text"],
        "defaultOutputModes": ["text"],
        "skills": json.loads(os.environ.get("AGENT_SKILLS", "[]")),
    }
```

## Auto-Scaling with HPA

CPU-based scaling is a poor fit for A2A agents. An agent might be idle on CPU while waiting for an LLM API response but still occupying a connection slot. Scale on custom metrics instead -- active tasks or queue depth.

First, expose a Prometheus metric from your agent:

```python
from prometheus_client import Gauge

active_tasks = Gauge("a2a_active_tasks", "Number of tasks currently being processed")

# In your task handler:
async def handle_task(task):
    active_tasks.inc()
    try:
        result = await process(task)
        return result
    finally:
        active_tasks.dec()
```

Then configure HPA with the Prometheus adapter:

```yaml
# k8s/agent-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: research-agent-hpa
  namespace: agents
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: research-agent
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Pods
      pods:
        metric:
          name: a2a_active_tasks
        target:
          type: AverageValue
          averageValue: "5"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 2
          periodSeconds: 120
```

This scales up when the average active tasks per pod exceeds 5, adding up to 4 pods per minute. Scale-down is more conservative -- 5-minute stabilization prevents flapping during bursty workloads.

## Helm Chart Structure

For managing multiple agents across environments, a Helm chart keeps configuration DRY:

```
a2a-agent/
  Chart.yaml
  values.yaml
  templates/
    deployment.yaml
    service.yaml
    configmap.yaml
    hpa.yaml
    secret.yaml
```

The `values.yaml` captures per-agent configuration:

```yaml
# values.yaml
agent:
  name: research-agent
  image:
    repository: ghcr.io/your-org/research-agent
    tag: "1.2.0"
  replicas: 2
  port: 8000

  card:
    name: "Research Assistant"
    description: "AI research agent for summarization"
    version: "1.2.0"
    skills: []

  resources:
    requests:
      cpu: "250m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "1Gi"

  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 20
    targetActiveTasksPerPod: 5

  secrets:
    llmApiKeySecret: llm-credentials
    llmApiKeyField: openai-api-key
```

Deploy multiple agents with overrides:

```bash
helm install research-agent ./a2a-agent -f values-research.yaml -n agents
helm install code-review-agent ./a2a-agent -f values-code-review.yaml -n agents
helm install data-agent ./a2a-agent -f values-data.yaml -n agents
```

## Graceful Shutdown

A2A tasks can be long-running. Configure a `preStop` hook and `terminationGracePeriodSeconds` to let in-flight tasks complete:

```yaml
spec:
  terminationGracePeriodSeconds: 120
  containers:
    - name: agent
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 5"]
```

Your agent should handle `SIGTERM` by stopping new task acceptance while completing in-progress work:

```python
import signal
import asyncio

shutting_down = False

def handle_sigterm(*args):
    global shutting_down
    shutting_down = True

signal.signal(signal.SIGTERM, handle_sigterm)
```

## What to Do Next

Start with a single agent deployment and Service. Verify that other pods in the cluster can reach `/.well-known/agent-card.json` via the Service DNS name. Add the HPA once you have Prometheus metrics flowing. The Helm chart becomes worth it once you have three or more agents sharing the same deployment pattern.

For production, add a NetworkPolicy restricting agent-to-agent traffic to the `agents` namespace, and use an Ingress or Gateway API resource only for agents that need external access.
