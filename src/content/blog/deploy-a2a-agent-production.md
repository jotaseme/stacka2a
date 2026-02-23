---
title: "How to Deploy an A2A Agent to Production"
description: "Everything you need to deploy an A2A agent for real traffic. Docker, gunicorn, Cloud Run, environment config, health checks, TLS, monitoring, and Agent Card URL management."
date: "2026-03-02"
readingTime: 9
tags: ["a2a", "deployment", "production", "devops"]
relatedStacks: ["google-adk-stack"]
---

Building an A2A agent locally is the easy part. Getting it into production with proper infrastructure is where most teams stall. This covers the full path: containerization, process management, cloud deployment, HTTPS, health checks, monitoring, and the Agent Card URL problem.

## Application server

Don't run uvicorn directly in production. Use gunicorn with uvicorn workers:

```bash
pip install gunicorn uvicorn[standard]
```

```bash
gunicorn agent:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --graceful-timeout 30 \
  --access-logfile - \
  --error-logfile -
```

- **`-w 4`** -- 4 workers. Start with `2 * CPU_CORES + 1`.
- **`-k uvicorn.workers.UvicornWorker`** -- async workers for SSE streaming.
- **`--timeout 120`** -- long enough for LLM calls and tool execution.
- **`--graceful-timeout 30`** -- time for in-flight requests to complete on shutdown.

## Docker

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

CMD ["gunicorn", "agent:app", \
     "-w", "4", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120"]
```

```bash
docker build -t my-a2a-agent:latest .
docker run -p 8000:8000 -e GOOGLE_API_KEY="${GOOGLE_API_KEY}" my-a2a-agent:latest
```

### Docker Compose

```yaml
services:
  agent:
    build: .
    ports:
      - "8000:8000"
    environment:
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - AGENT_URL=http://localhost:8000
      - LOG_LEVEL=info
    restart: unless-stopped
```

## Environment configuration

Never hardcode URLs or secrets:

```python
# config.py
import os

class Config:
    AGENT_NAME = os.getenv("AGENT_NAME", "My Agent")
    AGENT_VERSION = os.getenv("AGENT_VERSION", "1.0.0")
    AGENT_URL = os.getenv("AGENT_URL", "http://localhost:8000")
    PORT = int(os.getenv("PORT", "8000"))
    WORKERS = int(os.getenv("WORKERS", "4"))
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
```

Use `AGENT_URL` in your Agent Card:

```python
agent_card = AgentCard(
    name=Config.AGENT_NAME,
    url=Config.AGENT_URL,  # Must match the public URL
    version=Config.AGENT_VERSION,
    # ...
)
```

## Health checks

Add a dedicated health endpoint -- don't rely on the Agent Card endpoint alone:

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse

@app.get("/health")
async def health():
    checks = {"status": "healthy", "checks": {}}
    try:
        checks["checks"]["llm"] = "ok"  # Verify LLM connectivity
    except Exception as e:
        checks["checks"]["llm"] = f"error: {e}"
        checks["status"] = "degraded"
    status_code = 200 if checks["status"] != "unhealthy" else 503
    return JSONResponse(content=checks, status_code=status_code)

@app.get("/ready")
async def ready():
    return {"ready": True}
```

## Deploy to Google Cloud Run

Cloud Run handles HTTPS, scaling, and container orchestration:

```bash
gcloud auth configure-docker
docker build -t gcr.io/YOUR_PROJECT/my-a2a-agent:latest .
docker push gcr.io/YOUR_PROJECT/my-a2a-agent:latest

gcloud run deploy my-a2a-agent \
  --image gcr.io/YOUR_PROJECT/my-a2a-agent:latest \
  --platform managed \
  --region us-central1 \
  --port 8000 \
  --memory 1Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "AGENT_URL=https://my-a2a-agent-HASH.run.app,LOG_LEVEL=info" \
  --set-secrets "GOOGLE_API_KEY=google-api-key:latest" \
  --allow-unauthenticated
```

- **`--timeout 300`** -- 5 minutes for long-running tasks.
- **`--min-instances 1`** -- avoid cold starts. Set to 0 if you can tolerate them.
- **`--allow-unauthenticated`** -- Agent Card must be public. Implement auth at the app level ([OAuth2 guide](/blog/secure-a2a-agents-oauth2)).

Cloud Run supports SSE streaming natively. For tasks longer than a few minutes, use push notifications instead.

## TLS / HTTPS

If you're not on a managed platform, you need TLS. Agent Cards with `http://` URLs signal an insecure deployment.

### Caddy (auto Let's Encrypt)

```
# Caddyfile
my-agent.example.com {
    reverse_proxy localhost:8000
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
}
```

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name my-agent.example.com;

    ssl_certificate /etc/letsencrypt/live/my-agent.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/my-agent.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Critical for SSE streaming
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

The `proxy_buffering off` directive is critical. Without it, nginx buffers the response and clients won't see SSE events until the stream closes.

## Agent Card URL management

The `url` field must match the public URL where clients send requests. This causes real problems across environments:

- **Local dev**: `http://localhost:8000`
- **Docker**: `http://host.docker.internal:8000`
- **Staging**: `https://staging-agent.example.com`
- **Production**: `https://agent.example.com`

Use environment variables. For agents behind a load balancer, `url` should be the external-facing URL, not the internal one.

### Custom domain on Cloud Run

```bash
gcloud run domain-mappings create \
  --service my-a2a-agent \
  --domain agent.example.com \
  --region us-central1
```

Then set `AGENT_URL=https://agent.example.com`.

## Monitoring

### Structured logging

```python
import logging, json, sys

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
        })

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())
logger = logging.getLogger("a2a-agent")
logger.addHandler(handler)
logger.setLevel(logging.INFO)
```

### What to monitor

- **Task completion rate** -- percentage of `completed` vs `failed` tasks
- **Task duration** -- p50, p95, p99 latency for `message/send`
- **Active SSE connections** -- streaming connection count and duration
- **Error rate** -- auth failures, invalid input, LLM errors
- **Agent Card requests** -- spikes indicate scanning or new integrations
- **LLM latency** -- track separately if your agent calls an LLM

## Production checklist

- [ ] Agent Card `url` matches production domain
- [ ] HTTPS with valid certificates
- [ ] Health check endpoint at `/health`
- [ ] Environment variables for all secrets and config
- [ ] Non-root user in Docker container
- [ ] Graceful shutdown handling
- [ ] Structured logging to stdout
- [ ] Request timeout configured (gunicorn, Cloud Run, nginx)
- [ ] SSE proxy buffering disabled behind reverse proxy
- [ ] Auth implemented for sensitive agents ([OAuth2 guide](/blog/secure-a2a-agents-oauth2))
- [ ] Rate limiting on Agent Card endpoint
- [ ] Errors return `failed` task state, not HTTP 500s

## Next steps

- [A2A Protocol Tutorial](/blog/a2a-protocol-tutorial-beginners) -- if you haven't built an agent yet
- [Secure A2A Agents with OAuth2](/blog/secure-a2a-agents-oauth2) -- authentication and authorization
- [Agent Card JSON Schema Reference](/blog/a2a-agent-card-json-schema) -- get your card right before deploying
- Browse production-ready [stacks](/stacks) and [agents](/agents) for reference architectures
