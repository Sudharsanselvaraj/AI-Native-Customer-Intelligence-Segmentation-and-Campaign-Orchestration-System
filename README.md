<div align="center">
<img src="Readme assets/ChatGPT Image Jun 12, 2026, 07_00_08 PM.png" alt="AsterCRM Logo" width="300">

### The Autonomous Customer Engagement Intelligence Platform.

Transform customer data into AI-powered segments, campaigns, predictions, and actionable business insights.

<br>

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![Version](https://img.shields.io/badge/version-v1.0.0-blue)
![Status](https://img.shields.io/badge/status-production-success)
![Architecture](https://img.shields.io/badge/architecture-agentic-purple)


</div>

---

AsterCRM is an autonomous customer engagement intelligence platform that transforms customer data into actionable insights, intelligent audience segments, AI-generated campaigns, and predictive business outcomes.

The platform orchestrates customer discovery, behavioral analysis, segmentation, campaign generation, performance tracking, and AI-powered decision-making through a unified agentic workflow.

> [!TIP]
>
> Just getting started? AsterCRM can automatically identify high-value customer segments, predict customer behavior, generate personalized marketing campaigns, recommend engagement strategies, analyze campaign performance, and provide AI-driven business insights through a human-in-the-loop autonomous CRM workflow.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Entity-Relationship Diagram](#entity-relationship-diagram)
3. [Sequence Diagram — Campaign Lifecycle](#sequence-diagram--campaign-lifecycle)
4. [Features](#features)
5. [Quick Start](#quick-start-docker-compose)
6. [API Reference](#api-reference)
7. [AI Copilot — Agentic Workflow](#ai-copilot--agentic-workflow)
8. [System Design Decisions](#system-design-decisions)
9. [Scalability Analysis](#scalability-analysis)
10. [Running Tests](#running-tests)
11. [Deployment](#deployment-render--neon--vercel)
12. [Architecture Decision Records](#architecture-decision-records)

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (port 3000)                  │
│  Dashboard · Customers · Segments · Campaigns · Analytics ·      │
│  AI Copilot (agentic workflow + plan approval UI)                │
│  WebSocket client — live campaign event streaming                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ REST API + WebSocket (/ws/campaigns/)
┌────────────────────────────▼─────────────────────────────────────┐
│                FastAPI CRM Service (port 8000)                   │
│                                                                  │
│  /api/customers    /api/orders      /api/segments                │
│  /api/campaigns    /api/analytics   /api/copilot                 │
│  /api/receipts     /ws/campaigns/{id}  /health                   │
│                                                                  │
│  Middleware: Request-ID injection · CORS · Structured logging    │
│  Services: CustomerSvc · SegmentSvc · CampaignSvc · AISvc        │
│  Workers:  CampaignWorker (queue: campaigns)                     │
│            AnalyticsWorker (queue: analytics)                    │
├──────────────┬──────────────────────────┬────────────────────────┤
│  PostgreSQL  │  Redis                   │  OpenRouter (Claude)   │
│  (8 tables)  │  Broker + cache          │  NL→SQL · Campaign AI  │
│              │                          │  Copilot · Insights    │
└──────────────┴──────────┬───────────────┴────────────────────────┘
                          │ HTTP POST /send
┌─────────────────────────▼────────────────────────────────────────┐
│            Channel Simulator Service (port 8001)                 │
│  POST /send  →  Celery task  →  simulate delivery lifecycle      │
│                                                                  │
│  Per-channel probability profiles:                               │
│  WhatsApp: delivered 92% · opened 78% · clicked 22%              │
│  Email:    delivered 88% · opened 35% · clicked 12%              │
│  SMS:      delivered 95% · opened 90% · clicked 8%               │
│  RCS:      delivered 85% · opened 60% · clicked 18%              │
└─────────────────────────┬────────────────────────────────────────┘
                          │ POST /api/receipts/webhook (async)
                          └──────────────▶ CRM (event loop closes)
```

**Two-service callback loop:**  
CRM dispatches → Channel Simulator queues Celery task → task fires realistic events back → CRM ingests idempotently → analytics worker updates materialized row → WebSocket broadcasts to dashboard.

---

## Entity-Relationship Diagram

```
customers ──────────────────────────────────────────────┐
│ id (PK)                                               │
│ name, email (unique), phone, city, gender, age        │
│ created_at                                            │
│                                                       │
│  1                                                    │
│  │ has many                                           │
│  ▼                                                    │
orders                    segments                      │
│ id (PK)                 │ id (PK)                     │
│ customer_id (FK) ───────┘ name, description           │
│ amount, category          query_definition (JSON)     │
│ purchase_date             estimated_size              │
│ created_at                is_smart, created_at        │
                            │                           │
                            │ 1                         │
                            │ has many                  │
                            ▼                           │
                         campaigns                      │
                         │ id (PK)                      │
                         │ name, description            │
                         │ channel (enum)               │
                         │ segment_id (FK)              │
                         │ status (enum)                │
                         │ message_template             │
                         │ ai_generated, expected_*     │
                         │ started_at, completed_at     │
                         │                              │
                         │ 1                            │
                         │ has many                     │
                         ▼                              │
                      communications ◄─────────────────┘
                      │ id (PK)            (customer_id FK)
                      │ campaign_id (FK)
                      │ customer_id (FK)
                      │ message, status (enum)
                      │ channel, sent_at
                      │ idempotency_key (unique)
                      │
                      ├──▶ communication_events
                      │    │ id (PK)
                      │    │ communication_id (FK)
                      │    │ event_type (SENT|DELIVERED|...)
                      │    │ event_time, metadata (JSON)
                      │
                      └──▶ channel_logs
                           │ id (PK)
                           │ communication_id (FK)
                           │ payload, response (JSON)

campaigns ──▶ campaign_analytics (1:1 materialized)
              │ campaign_id (FK, unique)
              │ total_sent, total_delivered, total_failed
              │ total_opened, total_read, total_clicked, total_converted
              │ delivery_rate, open_rate, click_rate, conversion_rate
              │ updated_at
```

---

## Sequence Diagram — Campaign Lifecycle

```
Marketer      Frontend       CRM API        Celery         Channel Sim    Analytics
   │              │              │          Worker             │            Worker
   │──create ──▶  │              │              │              │              │
   │  segment     │──POST ──────▶│              │              │              │
   │  (NL)        │  /segments/  │──Claude─────▶│              │              │
   │              │  from-nl     │  NL→SQL      │              │              │
   │              │◀─────────────│  (WHERE)     │              │              │
   │◀─────────────│  segment_id  │              │              │              │
   │              │              │              │              │              │
   │──generate ──▶│              │              │              │              │
   │  campaign    │──POST ──────▶│              │              │              │
   │              │  /campaigns/ │──Claude─────▶│              │              │
   │              │  generate    │  generate    │              │              │
   │              │◀─────────────│  (JSON)      │              │              │
   │  reviews AI  │              │              │              │              │
   │  suggestion  │──POST ──────▶│              │              │              │
   │  saves it    │  /campaigns  │              │              │              │
   │              │◀─────────────│ campaign_id  │              │              │
   │              │              │              │              │              │
   │──launch ────▶│              │              │              │              │
   │              │──POST ──────▶│              │              │              │
   │              │  /{id}/launch│──enqueue ───▶│              │              │
   │              │◀─────────────│  dispatch_   │              │              │
   │  status:     │  running     │  campaign    │              │              │
   │  RUNNING     │              │              │              │              │
   │              │              │              │──POST /send▶ │              │
   │              │              │              │  (per cust)  │              │
   │              │              │              │              │──async──────▶│
   │              │              │              │              │  Celery task │
   │              │              │◀─────────────────────────── │              │
   │              │              │  POST /webhook SENT         │              │
   │              │              │──────────────────────────────────────────▶ │
   │              │              │  update_analytics.delay()   │              │
   │              │◀─ WS event ──│  broadcast to WebSocket     │              │
   │  dashboard   │  {SENT}      │              │              │              │
   │  updates     │              │              │              │──DELIVERED──▶│
   │  live        │              │◀─────────────────────────── │  (callback)  │
   │              │◀─ WS event ──│  DELIVERED   │              │              │
   │              │  {DELIVERED} │              │              │   ... OPENED, CLICKED, CONVERTED
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Customer & Order Ingestion** | REST API + CSV bulk import, paginated search |
| **AI Segment Builder** | Natural language → SQL WHERE clause → audience count + revenue estimate |
| **Campaign Engine** | AI-generated campaigns with channel recommendation and confidence score |
| **Agentic Workflow** | Goal → AI plans segment + campaign + channel → user approves → auto-executes |
| **Channel Simulator** | Realistic delivery/open/click/convert simulation with per-channel probability profiles |
| **Real-Time Analytics** | WebSocket streaming — dashboard updates live as events arrive |
| **AI Insights** | Claude analyzes current KPIs and surfaces 3–5 actionable recommendations |
| **Idempotent Webhooks** | Duplicate event detection, forward-only status upgrades |
| **Materialized Analytics** | Campaign KPIs precomputed by Celery worker — sub-millisecond dashboard reads |
| **Request Tracing** | Every request tagged with `X-Request-ID` in logs and response headers |
| **Structured Logging** | `structlog` JSON logs with request_id, campaign_id, communication_id context |

---

## Quick Start (Docker Compose)

```bash
# 1. Clone and configure
cp backend/.env.example backend/.env
# Edit backend/.env — set OPENROUTER_API_KEY

# 2. Start all 7 services
docker compose up -d

# 3. Seed 10,000 customers + 50,000 orders + 7 smart segments
docker compose exec crm python -m scripts.seed

# 4. Open http://localhost:3000
```

### Services started by Docker Compose

| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL 15 |
| `redis` | 6379 | Redis 7 |
| `crm` | 8000 | FastAPI CRM API + WebSocket |
| `crm-worker` | — | Celery worker (campaigns + analytics queues) |
| `channel-simulator` | 8001 | Channel delivery simulator API |
| `channel-worker` | — | Celery worker for delivery simulation |
| `frontend` | 3000 | Next.js 15 dashboard |

### Local Dev (no Docker)

```bash
# Prerequisites: PostgreSQL 15, Redis 7

# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Celery worker
celery -A app.core.celery_app worker -Q campaigns,analytics --loglevel=info

# Channel Simulator
cd channel-simulator
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
celery -A app.tasks.celery_app worker --loglevel=info

# Frontend
cd frontend
npm install
npm run dev
```

---

## API Reference

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/customers` | Paginated list with search, city filter |
| `POST` | `/api/customers` | Create customer |
| `GET` | `/api/customers/{id}` | Get customer + order history |
| `PATCH` | `/api/customers/{id}` | Update customer |
| `POST` | `/api/customers/import/csv` | Bulk import via CSV |
| `GET` | `/api/customers/cities` | List all cities |

### Segments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/segments` | List segments |
| `POST` | `/api/segments/from-nl` | **Create segment from natural language** |
| `GET` | `/api/segments/{id}/customers` | List customers in segment |
| `POST` | `/api/segments/{id}/refresh-size` | Recount audience |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/campaigns` | List campaigns with status filter |
| `POST` | `/api/campaigns` | Create campaign |
| `POST` | `/api/campaigns/generate` | **AI-generate campaign details** |
| `GET` | `/api/campaigns/{id}` | Get campaign + analytics |
| `POST` | `/api/campaigns/{id}/launch` | Launch campaign |
| `GET` | `/api/campaigns/{id}/analytics` | Campaign funnel metrics |
| `POST` | `/api/campaigns/recommend-channel` | **AI channel recommendation** |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/dashboard` | Global KPIs + trends |
| `GET` | `/api/analytics/insights` | **AI-generated actionable insights** |

### AI Copilot

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/copilot` | Multi-turn chat with tool calling |

### Receipts (Channel Callbacks)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/receipts/webhook` | Single event callback |
| `POST` | `/api/receipts/webhook/bulk` | Batch event ingestion |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `WS /ws/campaigns/{campaign_id}` | Real-time event stream for a campaign |

---

## AI Copilot — Agentic Workflow

The copilot uses Claude's tool-calling to perform real CRM operations:

### Available Tools

| Tool | Description |
|------|-------------|
| `create_segment` | NL → SQL → customer segment |
| `create_campaign` | AI-generate and save a campaign |
| `launch_campaign` | Execute a campaign |
| `get_analytics` | Fetch dashboard KPIs |
| `list_segments` | List available segments |
| `plan_workflow` | **Plan a full campaign workflow from a goal (requires approval)** |

### Agentic Workflow Example

```
User: "I want to increase repeat purchases from beauty shoppers who haven't bought in 45 days"

AI: [calls plan_workflow(goal="...")]
    → Returns plan:
      {
        "segment": { "name": "Lapsed Beauty Shoppers", "natural_language": "..." },
        "campaign": { "name": "Beauty Re-engagement", "channel": "whatsapp", "confidence": 0.87 },
        "expected_outcomes": { "audience_size": "~1,200", "open_rate": 0.72 },
        "steps": [create_segment → create_campaign → launch_campaign]
      }

User: "Looks good, execute it"

AI: [calls create_segment] → segment_id
    [calls create_campaign(segment_id=...)] → campaign_id
    [calls launch_campaign(campaign_id=...)]
    → "Done! Campaign launched to 1,247 lapsed beauty shoppers via WhatsApp. Expected 900 opens."
```

---

## System Design Decisions

### Why two services?

Mirrors real-world channel delivery. The CRM doesn't know *when* messages are delivered — it learns via callbacks. This decouples dispatch from tracking and allows the simulator to model realistic async delays. ([ADR-001](docs/adr/ADR-001-two-service-channel-architecture.md))

### Why Celery + Redis?

Campaign dispatch against 10,000 customers cannot block an HTTP request. Celery gives us async execution, retry logic, and independent queue scaling. ([ADR-002](docs/adr/ADR-002-celery-redis-async-workers.md))

### Idempotency

Each communication has a `campaign_id:customer_id` idempotency key — prevents duplicate sends during retry. The receipt handler skips duplicate events (except CLICKED/CONVERTED which can repeat). Status upgrades are forward-only: PENDING → SENT → DELIVERED; never downgrade.

### Analytics strategy

Rather than slow aggregations at read time, a Celery task recomputes a materialized `campaign_analytics` row on each event. Dashboard reads are O(1). ([ADR-003](docs/adr/ADR-003-materialized-analytics-pattern.md))

### NL → SQL safety

Claude generates only a WHERE clause (no SELECT). The backend validates against a DDL blocklist (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`, `ALTER`, `CREATE`) before executing. Column names are locked to `customers` and `orders` schema.

### AI Copilot design

Standard Claude tool-calling loop (max 5 iterations). The `plan_workflow` tool returns a plan with `requires_approval: true` — enabling human-in-the-loop before executing multi-step actions. ([ADR-004](docs/adr/ADR-004-ai-copilot-tool-calling.md))

### Real-time WebSocket

A `ConnectionManager` maintains per-campaign WebSocket subscriptions. Receipt events broadcast to all subscribers after DB commit. Broadcast is best-effort (dead connections are pruned).

---

## Scalability Analysis

### Current architecture (demo scale)

- 10,000 customers · 50,000 orders — all queries sub-second with existing indexes
- Synchronous HTTP from CRM to Channel Simulator — works up to ~1,000 concurrent campaigns

### Bottlenecks at 10× scale

| Bottleneck | Current | At 10× |
|------------|---------|--------|
| Campaign dispatch | Celery single queue | Partition by channel; add workers |
| Channel simulator calls | Synchronous HTTP | Replace with SQS/Kafka; fan-out workers |
| Analytics recompute | Full aggregation per event | Incremental counter updates; Redis counters |
| NL→SQL latency | ~1.5s (Claude API) | Cache identical queries in Redis (30min TTL) |
| WebSocket broadcasting | In-memory manager | Redis pub/sub for multi-instance fanout |

### Horizontal scaling path

```
Load Balancer
     │
     ├── CRM Instance 1 ──┐
     ├── CRM Instance 2   ├── PostgreSQL (primary + read replica)
     └── CRM Instance 3 ──┘
              │
         Redis Pub/Sub ──▶ WebSocket broadcast across instances
              │
         Celery Workers (auto-scale on queue depth)
              │
         Channel Simulator Fleet (one per channel type)
```

---

## Running Tests

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest -v
```

Test coverage:

| Module | Tests |
|--------|-------|
| `test_customers.py` | CRUD, pagination, search, 409 on duplicate email |
| `test_segments.py` | NL creation (mocked AI), SQL safety blocklist |
| `test_campaigns.py` | Lifecycle: create → generate → launch, double-launch rejection |
| `test_receipts.py` | Idempotency, forward-only status, bulk webhook, unknown comm 404 |
| `test_analytics.py` | Dashboard structure, insights endpoint, health check |
| `test_copilot.py` | Chat with/without history, AI error handling, validation |

---

## Deployment (Render + Neon + Vercel)

1. **Database:** Neon PostgreSQL → copy connection string to `DATABASE_URL`
2. **Redis:** Upstash or Render Redis add-on
3. **CRM Service:** Render web service from `backend/` — set all env vars
4. **CRM Worker:** Same image, background worker, command: `celery -A app.core.celery_app worker -Q campaigns,analytics`
5. **Channel Simulator:** Separate Render web service from `channel-simulator/` + background worker
6. **Frontend:** Vercel → set `NEXT_PUBLIC_API_URL` to CRM service URL

---

## Architecture Decision Records

| ADR | Decision |
|-----|----------|
| [ADR-001](docs/adr/ADR-001-two-service-channel-architecture.md) | Two-service architecture for channel delivery |
| [ADR-002](docs/adr/ADR-002-celery-redis-async-workers.md) | Celery + Redis for async task processing |
| [ADR-003](docs/adr/ADR-003-materialized-analytics-pattern.md) | Materialized analytics pattern for campaign KPIs |
| [ADR-004](docs/adr/ADR-004-ai-copilot-tool-calling.md) | AI copilot with tool calling and agentic workflow |
