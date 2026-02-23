---
title: "Monitoring and Observability for A2A Agents"
description: "Production monitoring for A2A agents: task latency, error rates, throughput metrics, distributed tracing with OpenTelemetry, health checks, and alerting thresholds that actually matter."
date: "2026-03-26"
readingTime: 9
tags: ["a2a", "monitoring", "observability", "production"]
relatedStacks: []
relatedAgents: []
---

A2A agents are HTTP services. You already know how to monitor HTTP services. The difference is that A2A adds agent-specific dimensions: task state transitions, multi-turn conversation context, streaming performance, and cross-agent call chains. Standard APM catches some of this. The rest you need to instrument yourself.

This post covers what to measure, how to instrument it, and where to set alert thresholds.

## The Four Metrics That Matter

Every A2A agent in production needs these four metrics at minimum. Everything else is nice to have.

### 1. Task Latency

Measure time from `message/send` request receipt to final response. Break it down by task state:

```python
# metrics.py
import time
from prometheus_client import Histogram, Counter

TASK_DURATION = Histogram(
    "a2a_task_duration_seconds",
    "Time spent processing A2A tasks",
    labelnames=["method", "skill_id", "status"],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0],
)

TASK_STATE_TRANSITIONS = Counter(
    "a2a_task_state_transitions_total",
    "Count of task state transitions",
    labelnames=["from_state", "to_state"],
)
```

The buckets matter. Most A2A tasks involve LLM calls, so sub-100ms responses are rare. Set your lowest bucket at 100ms and your highest at 120s. Adjust after you have baseline data.

### 2. Error Rate

Track errors by type. A2A has distinct failure modes: JSON-RPC parse errors, auth failures, task execution failures, upstream agent timeouts.

```python
TASK_ERRORS = Counter(
    "a2a_task_errors_total",
    "Count of A2A task errors",
    labelnames=["error_type", "skill_id", "method"],
)

# Error types worth tracking separately
ERROR_TYPES = {
    "parse_error": -32700,      # Invalid JSON
    "invalid_request": -32600,  # Not valid JSON-RPC
    "method_not_found": -32601, # Unknown method
    "invalid_params": -32602,   # Bad params
    "internal_error": -32603,   # Server error
    "auth_error": 401,          # Authentication failed
    "forbidden": 403,           # Authorization failed
    "timeout": 408,             # Upstream timeout
    "rate_limited": 429,        # Rate limit hit
}
```

### 3. Throughput

Tasks per second, broken down by method and skill. This is your capacity planning metric.

```python
TASKS_IN_PROGRESS = Gauge(
    "a2a_tasks_in_progress",
    "Number of A2A tasks currently being processed",
    labelnames=["method", "skill_id"],
)

TASKS_RECEIVED = Counter(
    "a2a_tasks_received_total",
    "Total A2A tasks received",
    labelnames=["method", "skill_id"],
)
```

### 4. Streaming Performance

If your agent supports `message/stream`, measure SSE-specific metrics. Dropped connections, events per second, and time-to-first-event are the ones that expose real problems.

```python
STREAM_EVENTS_SENT = Counter(
    "a2a_stream_events_total",
    "Total SSE events sent",
    labelnames=["event_type", "skill_id"],
)

STREAM_TIME_TO_FIRST_EVENT = Histogram(
    "a2a_stream_ttfe_seconds",
    "Time from stream request to first SSE event",
    labelnames=["skill_id"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

STREAM_DROPPED_CONNECTIONS = Counter(
    "a2a_stream_dropped_total",
    "Count of dropped streaming connections",
    labelnames=["reason"],
)
```

## Instrumenting Your Agent

Here is a middleware that captures all four metric categories for a Starlette-based A2A agent:

```python
# middleware.py
import time
import json
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from metrics import (
    TASK_DURATION, TASK_ERRORS, TASKS_IN_PROGRESS,
    TASKS_RECEIVED, TASK_STATE_TRANSITIONS,
)


class A2AMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip non-A2A endpoints
        if request.url.path == "/.well-known/agent-card.json":
            return await call_next(request)

        # Parse the JSON-RPC request to extract method and skill
        body = await request.body()
        try:
            payload = json.loads(body)
            method = payload.get("method", "unknown")
            skill_id = self._extract_skill(payload)
        except (json.JSONDecodeError, AttributeError):
            TASK_ERRORS.labels(
                error_type="parse_error",
                skill_id="unknown",
                method="unknown",
            ).inc()
            return await call_next(request)

        TASKS_RECEIVED.labels(method=method, skill_id=skill_id).inc()
        TASKS_IN_PROGRESS.labels(method=method, skill_id=skill_id).inc()

        start = time.perf_counter()
        try:
            response = await call_next(request)
            duration = time.perf_counter() - start

            status = "success" if response.status_code < 400 else "error"
            TASK_DURATION.labels(
                method=method, skill_id=skill_id, status=status
            ).observe(duration)

            if response.status_code >= 400:
                TASK_ERRORS.labels(
                    error_type=f"http_{response.status_code}",
                    skill_id=skill_id,
                    method=method,
                ).inc()

            return response
        except Exception as e:
            duration = time.perf_counter() - start
            TASK_DURATION.labels(
                method=method, skill_id=skill_id, status="exception"
            ).observe(duration)
            TASK_ERRORS.labels(
                error_type=type(e).__name__,
                skill_id=skill_id,
                method=method,
            ).inc()
            raise
        finally:
            TASKS_IN_PROGRESS.labels(method=method, skill_id=skill_id).dec()

    def _extract_skill(self, payload: dict) -> str:
        """Extract skill ID from A2A message metadata if present."""
        params = payload.get("params", {})
        metadata = params.get("metadata", {})
        return metadata.get("skillId", "default")
```

Wire it up:

```python
from starlette.applications import Starlette
from prometheus_client import make_asgi_app

app = Starlette()
app.add_middleware(A2AMetricsMiddleware)

# Expose /metrics for Prometheus scraping
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

## Structured Logging

Unstructured log lines are useless at scale. Log JSON with consistent fields.

```python
# logging_config.py
import structlog
import logging

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)

logger = structlog.get_logger()
```

Log every task lifecycle event with correlation IDs:

```python
# task_handler.py
import structlog
import uuid

logger = structlog.get_logger()

async def handle_task(request_id: str, method: str, params: dict):
    task_id = params.get("id", str(uuid.uuid4()))
    context_id = params.get("contextId", "none")

    log = logger.bind(
        task_id=task_id,
        context_id=context_id,
        request_id=request_id,
        method=method,
    )

    log.info("task_received")

    try:
        result = await process_task(params)
        log.info("task_completed", duration_ms=result.duration_ms)
        return result
    except TimeoutError:
        log.error("task_timeout", timeout_seconds=60)
        raise
    except Exception as e:
        log.error("task_failed", error=str(e), error_type=type(e).__name__)
        raise
```

The `task_id` and `context_id` fields are critical. A2A multi-turn conversations share a `contextId` across turns. When something breaks on turn 4 of a 6-turn conversation, you need to pull the full context history to debug it.

## Distributed Tracing with OpenTelemetry

A2A agent chains create distributed call graphs. Agent A calls Agent B, which calls Agent C. Without distributed tracing, debugging a failure in Agent C that was triggered by a request to Agent A is guesswork.

### Setup

```python
# tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

resource = Resource.create({
    "service.name": "expense-agent",
    "service.version": "1.2.0",
    "deployment.environment": "production",
})

provider = TracerProvider(resource=resource)
exporter = OTLPSpanExporter(endpoint="http://otel-collector:4317")
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("a2a.agent")
```

### Propagating Context Across Agents

The key to distributed tracing across A2A agents: propagate the trace context in HTTP headers. The W3C Trace Context standard (`traceparent` header) handles this.

```python
# a2a_client.py
import httpx
from opentelemetry import trace, context
from opentelemetry.propagate import inject

tracer = trace.get_tracer("a2a.client")

async def call_remote_agent(agent_url: str, message: dict) -> dict:
    """Call a remote A2A agent with trace context propagation."""
    with tracer.start_as_current_span(
        "a2a.call",
        attributes={
            "a2a.agent.url": agent_url,
            "a2a.method": "message/send",
        },
    ) as span:
        headers = {"Content-Type": "application/json"}
        # Inject trace context into outgoing headers
        inject(headers)

        payload = {
            "jsonrpc": "2.0",
            "id": "req-1",
            "method": "message/send",
            "params": {"message": message},
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                agent_url, json=payload, headers=headers, timeout=60
            )

            span.set_attribute("http.status_code", response.status_code)

            if response.status_code >= 400:
                span.set_status(
                    trace.StatusCode.ERROR,
                    f"HTTP {response.status_code}",
                )

            return response.json()
```

On the receiving agent, extract the context:

```python
# a2a_server.py
from opentelemetry.propagate import extract

async def handle_request(request: Request):
    # Extract trace context from incoming headers
    ctx = extract(carrier=dict(request.headers))

    with tracer.start_as_current_span(
        "a2a.handle",
        context=ctx,
        attributes={
            "a2a.method": "message/send",
            "a2a.task.id": task_id,
        },
    ) as span:
        # Process the task -- this span is now a child
        # of the calling agent's span
        result = await process_task(request)
        return result
```

Now a single trace in Jaeger or Grafana Tempo shows the full call chain: Agent A -> Agent B -> Agent C, with timing for each hop.

### Custom Span Attributes for A2A

Add A2A-specific attributes to your spans so you can filter and search by protocol concepts:

```python
span.set_attribute("a2a.task.id", task_id)
span.set_attribute("a2a.context.id", context_id)
span.set_attribute("a2a.skill.id", skill_id)
span.set_attribute("a2a.task.state", "completed")
span.set_attribute("a2a.turn.number", turn_number)
span.set_attribute("a2a.streaming", True)
```

## Health Check Endpoints

Your load balancer and orchestration layer need to know if an agent is healthy. Implement two endpoints.

### Liveness: Is the Process Running?

```python
@app.route("/healthz")
async def liveness(request):
    return JSONResponse({"status": "ok"})
```

### Readiness: Can It Accept Tasks?

This one matters more. An agent can be alive but not ready -- waiting for a model to load, database connection pool exhausted, upstream dependency down.

```python
# health.py
import httpx

class HealthChecker:
    def __init__(self, agent_config: dict):
        self.llm_endpoint = agent_config["llm_endpoint"]
        self.db_pool = agent_config.get("db_pool")
        self.upstream_agents = agent_config.get("upstream_agents", [])

    async def check_readiness(self) -> dict:
        checks = {}

        # Check LLM provider
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    self.llm_endpoint, timeout=5
                )
                checks["llm"] = resp.status_code < 500
        except Exception:
            checks["llm"] = False

        # Check database connection pool
        if self.db_pool:
            checks["database"] = self.db_pool.size > 0

        # Check upstream A2A agents
        for agent_url in self.upstream_agents:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        f"{agent_url}/.well-known/agent-card.json",
                        timeout=5,
                    )
                    checks[agent_url] = resp.status_code == 200
            except Exception:
                checks[agent_url] = False

        return {
            "ready": all(checks.values()),
            "checks": checks,
        }


@app.route("/readyz")
async def readiness(request):
    checker = HealthChecker(app.state.config)
    result = await checker.check_readiness()
    status_code = 200 if result["ready"] else 503
    return JSONResponse(result, status_code=status_code)
```

Use `/healthz` for Kubernetes liveness probes. Use `/readyz` for readiness probes. If readiness fails, the load balancer stops sending traffic until the agent recovers.

## Alerting Thresholds

Here are starting thresholds. Adjust after you have two weeks of baseline data.

| Metric | Warning | Critical | Why |
|--------|---------|----------|-----|
| p99 task latency | > 30s | > 60s | LLM calls are slow, but 60s means something is stuck |
| Error rate | > 5% | > 15% | A2A tasks fail for many reasons; 5% is normal churn |
| Tasks in progress | > 80% capacity | > 95% capacity | Backpressure builds fast once you saturate |
| Stream drop rate | > 2% | > 10% | Network issues or client timeouts |
| Health check failures | 2 consecutive | 5 consecutive | Flaky checks happen; sustained failures are real |
| Auth error rate | > 1% | > 5% | Sudden spike = credential rotation issue or attack |

### Prometheus Alerting Rules

```yaml
# alerts.yml
groups:
  - name: a2a_agent_alerts
    rules:
      - alert: A2AHighLatency
        expr: histogram_quantile(0.99, rate(a2a_task_duration_seconds_bucket[5m])) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "A2A agent p99 latency above 30s"
          description: "{{ $labels.skill_id }} p99 latency is {{ $value }}s"

      - alert: A2AHighErrorRate
        expr: >
          rate(a2a_task_errors_total[5m])
          / rate(a2a_tasks_received_total[5m]) > 0.15
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "A2A agent error rate above 15%"

      - alert: A2AAgentNotReady
        expr: probe_success{job="a2a-readiness"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "A2A agent readiness check failing"

      - alert: A2AAuthErrors
        expr: >
          rate(a2a_task_errors_total{error_type="auth_error"}[5m])
          / rate(a2a_tasks_received_total[5m]) > 0.05
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "A2A auth error rate spike -- possible credential issue or attack"
```

## Grafana Dashboard Essentials

Build one dashboard with four rows:

1. **Overview**: Total tasks/sec, error rate, p50/p95/p99 latency, active tasks gauge
2. **Per-Skill Breakdown**: Latency and error rate per `skill_id`. This is where you find the one skill that is dragging everything down.
3. **Streaming**: Events/sec, time-to-first-event, dropped connections. Only relevant if your agent streams.
4. **Dependencies**: Upstream agent health, LLM provider latency, database connection pool usage.

The single most useful panel: a latency heatmap by skill over time. It shows you pattern changes -- a skill that was consistently 2s suddenly hitting 10s -- at a glance.

## What Most Teams Get Wrong

**Over-alerting on individual task failures.** A2A tasks fail. LLMs return bad responses. Upstream agents time out. Alert on rates, not individual events.

**Not tracking multi-turn context.** A task that succeeds on turn 1 and fails on turn 4 looks like a 75% success rate in aggregate metrics. Log and trace by `contextId` to see the full conversation trajectory.

**Ignoring Agent Card discovery metrics.** If discovery requests to `/.well-known/agent-card.json` spike 10x, either you have a new client onboarding (good) or someone is scraping your infrastructure (bad). Track it.

**Skipping the readiness check.** An agent that accepts tasks before its LLM provider connection is established will queue up failures. The readiness check prevents this.

---

Start with the four core metrics, structured logging, and health checks. Add distributed tracing when you have more than two agents calling each other. Add the Grafana dashboard when you need to debug something at 2 AM and realize you cannot.

See the [A2A Agent Discovery Security](/blog/a2a-agent-discovery-security) post for securing the endpoints you are now monitoring.
