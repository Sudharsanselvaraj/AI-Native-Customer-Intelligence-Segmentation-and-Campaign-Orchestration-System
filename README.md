<div align="center">

<img src="Readme assets/ChatGPT Image Jun 12, 2026, 07_00_08 PM.png" alt="AsterCRM Logo" width="380"/>

### Autonomous Customer Engagement Intelligence Platform

*An AI-native Mini CRM built for the Xeno Engineering Take-Home Assignment*

<br/>

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Celery](https://img.shields.io/badge/Celery-5-37814A?logo=celery)](https://docs.celeryq.dev)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## The Bet I Made

The Xeno brief was intentionally open. Rather than building a shallow feature list, I made one opinionated architectural bet: **make the AI the primary interface, not a sidebar**.

AsterCRM is built around a conversational copilot that can plan, create, and execute entire campaign workflows from a single natural-language goal — with a human approval gate before anything irreversible happens. The marketer describes intent; the AI figures out the segment, generates the campaign copy, recommends the channel, and launches — while the marketer stays in control.

The rest of the stack (two-service async delivery loop, materialized analytics, WebSocket streaming) exists to make that AI interaction feel real and trustworthy.

---

## Live Demo

| Surface | URL |
|---------|-----|
| **Frontend** | `https://aster-crm.vercel.app` |
| **CRM API** | `https://aster-crm-api.onrender.com/docs` |
| **Channel Simulator** | `https://aster-channel-sim.onrender.com/docs` |

> **Seed data:** 10,000 customers · 50,000 orders · 7 pre-built smart segments — all generated with realistic demographics, purchase history, and multi-channel engagement patterns.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The AI-Native Core — Agentic Copilot](#the-ai-native-core--agentic-copilot)
3. [Campaign Delivery Loop](#campaign-delivery-loop)
4. [Data Model](#data-model)
5. [Feature Walkthrough](#feature-walkthrough)
6. [API Reference](#api-reference)
7. [System Design Decisions](#system-design-decisions)
8. [Scalability Analysis](#scalability-analysis)
9. [Running Locally](#running-locally)
10. [Tests](#tests)
11. [Deployment Guide](#deployment-guide)
12. [Architecture Decision Records](#architecture-decision-records)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (port 3000)                  │
│  Dashboard · Customers · Segments · Campaigns · Analytics        │
│  AI Copilot (plan → approve → execute) · Mission Control         │
│  WebSocket client — live campaign event streaming                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼─────────────────────────────────────┐
│                FastAPI CRM Service (port 8000)                   │
│                                                                  │
│  /api/customers    /api/orders      /api/segments                │
│  /api/campaigns    /api/analytics   /api/copilot                 │
│  /api/receipts     /ws/campaigns/{id}                            │
│                                                                  │
│  Services: CustomerSvc · SegmentSvc · CampaignSvc · AISvc        │
│  Workers:  CampaignWorker  ·  AnalyticsWorker                    │
├──────────────┬──────────────────────────┬────────────────────────┤
│  PostgreSQL  │  Redis                   │  OpenRouter (Claude)   │
│  (8 tables)  │  Task broker + cache     │  NL→SQL · Campaign gen │
│              │                          │  Copilot · Insights    │
└──────────────┴──────────┬───────────────┴────────────────────────┘
                          │ POST /send (per communication)
┌─────────────────────────▼────────────────────────────────────────┐
│            Channel Simulator Service (port 8001)                 │
│                                                                  │
│  POST /send  →  Celery task  →  simulate delivery lifecycle      │
│                                                                  │
│  Per-channel probability profiles:                               │
│  WhatsApp  delivered 92% · opened 78% · clicked 22%             │
│  Email     delivered 88% · opened 35% · clicked 12%             │
│  SMS       delivered 95% · opened 90% · clicked  8%             │
│  RCS       delivered 85% · opened 60% · clicked 18%             │
└─────────────────────────┬────────────────────────────────────────┘
                          │ POST /api/receipts/webhook (async callbacks)
                          └──────────────▶ CRM closes the event loop
```

**Seven Docker services:** `postgres` · `redis` · `crm` (FastAPI) · `crm-worker` (Celery) · `channel-simulator` (FastAPI) · `channel-worker` (Celery) · `frontend` (Next.js 15)

---

## The AI-Native Core — Agentic Copilot

This is where I spent the most design effort. The copilot is a Claude-powered agent with **six registered tools** that perform real CRM operations.

### Available Tools

| Tool | What it does |
|------|-------------|
| `plan_workflow` | Takes a high-level goal, queries live analytics, returns a complete execution plan — requires human approval before proceeding |
| `create_segment` | Translates natural language into a safe PostgreSQL WHERE clause, counts the audience, saves the segment |
| `create_campaign` | AI-generates campaign name, copy, channel recommendation, and expected engagement — saves to DB |
| `launch_campaign` | Enqueues the Celery dispatch task; transitions status to RUNNING |
| `get_analytics` | Fetches live dashboard KPIs for the AI to reason about |
| `list_segments` | Returns current segments with audience sizes |

### Agentic Loop

The copilot runs a **standard tool-calling loop** (up to 5 iterations). The `plan_workflow` tool is the only one that returns `requires_approval: true` — this is the human-in-the-loop gate before any multi-step irreversible action.

```
Marketer: "Re-engage beauty shoppers who haven't bought in 45 days"

AI calls: plan_workflow(goal="...")
  → Returns plan:
    {
      "segment": { "name": "Lapsed Beauty Shoppers", "nl": "customers who bought in beauty
                    category but have no orders in the last 45 days" },
      "campaign": { "name": "We Miss You", "channel": "whatsapp", "confidence": 0.87 },
      "expected_outcomes": { "audience_size": "~1,240", "open_rate": 0.72 },
      "steps": ["create_segment", "create_campaign", "launch_campaign"],
      "requires_approval": true
    }

Marketer: "Looks good, go ahead"

AI calls: create_segment(...)   → segment_id
AI calls: create_campaign(...)  → campaign_id
AI calls: launch_campaign(...)  → status: running

AI: "Done. Campaign launched to 1,247 lapsed beauty shoppers via WhatsApp.
     Estimated 900 opens and 272 clicks based on current channel benchmarks."
```

### NL → SQL Safety

When creating segments from natural language, Claude generates **only a WHERE clause** — no SELECT, no DDL. The backend validates against a blocklist (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`, `ALTER`, `CREATE`) before execution. Column names are locked to the `customers` and `orders` schema.

---

## Campaign Delivery Loop

```
Marketer           Frontend           CRM API            Celery            Channel Sim
    │                  │                  │               Worker                │
    │── launch ───────▶│                  │                  │                  │
    │                  │── POST /launch ─▶│                  │                  │
    │                  │                  │── enqueue ──────▶│                  │
    │                  │◀─ status:RUNNING─│  dispatch_       │                  │
    │                  │                  │  campaign        │                  │
    │                  │                  │                  │── POST /send ───▶│
    │                  │                  │                  │  (per customer)  │
    │                  │                  │                  │                  │── Celery task
    │                  │                  │◀─────────────────────────────────── │  (async)
    │                  │                  │  POST /receipts/webhook SENT        │
    │                  │                  │── update analytics ────────────────▶│
    │                  │◀─ WS broadcast ──│  broadcast SENT                     │
    │  live dashboard  │                  │                  │                  │
    │  updates         │                  │◀──────────────── │── DELIVERED ────▶│
    │                  │◀─ WS broadcast ──│  DELIVERED       │                  │
    │                  │                  │                  │   ... OPENED, CLICKED, CONVERTED
```

**Idempotency:** Each communication has a `campaign_id:customer_id` idempotency key — prevents duplicate sends on Celery retry. Receipt events skip duplicates; status transitions are forward-only (PENDING → SENT → DELIVERED, never backwards).

---

## Data Model

```
customers ──────────────────────────────────────────────────────┐
│ id · name · email (unique) · phone · city · gender · age      │
│ created_at                                                    │
│                                                               │
│  1:N                                                          │
▼                                                               │
orders                    segments                              │
│ id · customer_id (FK)   │ id · name · description            │
│ amount · category       │ query_definition (JSON WHERE)      │
│ purchase_date           │ estimated_size                     │
│                         │ is_smart · created_at              │
                          │                                     │
                          │ 1:N                                 │
                          ▼                                     │
                       campaigns                                │
                       │ id · name · description               │
                       │ channel (enum)                        │
                       │ segment_id (FK)                       │
                       │ status (enum)                         │
                       │ message_template                      │
                       │ ai_generated · expected_*             │
                       │ started_at · completed_at             │
                       │                                       │
                       │ 1:N                                   │
                       ▼                                       │
                    communications ◄────────────────────────── ┘
                    │ id · campaign_id (FK)     (customer_id FK)
                    │ customer_id (FK)
                    │ message · status (enum)
                    │ channel · sent_at
                    │ idempotency_key (unique)
                    │
                    ├──▶ communication_events
                    │    │ id · communication_id (FK)
                    │    │ event_type (SENT|DELIVERED|OPENED|READ|CLICKED|CONVERTED)
                    │    │ event_time · metadata (JSON)
                    │
                    └──▶ channel_logs
                         │ id · communication_id (FK)
                         │ payload · response (JSON)

campaigns ──▶ campaign_analytics  (1:1 materialized row)
             │ campaign_id (FK, unique)
             │ total_sent · total_delivered · total_failed
             │ total_opened · total_read · total_clicked · total_converted
             │ delivery_rate · open_rate · click_rate · conversion_rate
             │ updated_at
```

---

## Feature Walkthrough

### Customer & Order Ingestion
REST API for individual records + CSV bulk import with validation. Paginated list view with search by name/email and filter by city. Customer detail page shows full order history and communication timeline.

### AI Segment Builder
Describe an audience in plain English — "high-value customers from Mumbai who bought electronics in the last 90 days and haven't opened our last campaign" — and AsterCRM:
1. Sends it to Claude with schema context
2. Receives a safe WHERE clause
3. Runs `SELECT COUNT(*)` against the real DB
4. Returns the estimated audience size and stores the segment

### Campaign Engine
- **AI Generate:** Give a campaign goal; Claude returns a structured JSON with name, message copy, recommended channel, and expected open/click rates
- **Manual Create:** Full form with channel selector and message composer
- **Launch:** Enqueues Celery task; transitions to RUNNING immediately

### Real-Time Analytics Dashboard
WebSocket connection to `/ws/campaigns/{id}` streams events as they arrive from the channel simulator. The dashboard updates delivery/open/click/conversion funnels in real time without polling.

### AI Insights
`GET /api/analytics/insights` — Claude analyzes current KPIs and returns 3–5 prioritized, actionable recommendations (e.g., "WhatsApp CTR is 2.3× your email CTR but only 18% of campaigns use it — consider shifting the next re-engagement campaign").

### Mission Control
Unified view of all active campaigns with live status, running analytics, and one-click abort.

---

## API Reference

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/customers` | Paginated list — search, city filter |
| `POST` | `/api/customers` | Create customer |
| `GET` | `/api/customers/{id}` | Customer + full order history |
| `PATCH` | `/api/customers/{id}` | Update customer |
| `POST` | `/api/customers/import/csv` | Bulk CSV import |
| `GET` | `/api/customers/cities` | Available cities |

### Segments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/segments` | List segments |
| `POST` | `/api/segments/from-nl` | **Natural language → segment** |
| `GET` | `/api/segments/{id}/customers` | Audience members |
| `POST` | `/api/segments/{id}/refresh-size` | Recount audience |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/campaigns` | List with status filter |
| `POST` | `/api/campaigns` | Create campaign |
| `POST` | `/api/campaigns/generate` | **AI-generate campaign details** |
| `GET` | `/api/campaigns/{id}` | Campaign + analytics |
| `POST` | `/api/campaigns/{id}/launch` | Launch campaign |
| `GET` | `/api/campaigns/{id}/analytics` | Full funnel metrics |
| `POST` | `/api/campaigns/recommend-channel` | **AI channel recommendation** |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/dashboard` | Global KPIs, trends, channel breakdown |
| `GET` | `/api/analytics/insights` | **AI-generated actionable insights** |

### AI Copilot

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/copilot` | Multi-turn chat with tool-calling |

### Receipts (Channel Callbacks)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/receipts/webhook` | Single event callback |
| `POST` | `/api/receipts/webhook/bulk` | Batch event ingestion |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `WS /ws/campaigns/{campaign_id}` | Live event stream for a campaign |

---

## System Design Decisions

### Why two separate services?

Real channel providers (Twilio, MSG91, SendGrid) are **not synchronous**. You fire a request; they acknowledge receipt; delivery events trickle in asynchronously over minutes. Merging the simulator into the CRM would let me cheat — I'd have direct function calls instead of the actual async callback pattern. The two-service loop forces me to handle queuing, retries, and event ordering the way production code must.

See [ADR-001](docs/adr/ADR-001-two-service-channel-architecture.md).

### Why Celery + Redis, not background threads?

Campaign dispatch against 10,000 customers cannot block an HTTP request. Celery gives:
- **Retry logic** — `max_retries=3, default_retry_delay=30` on the dispatch task
- **Queue isolation** — `campaigns` and `analytics` are separate queues; a slow analytics recompute can't starve campaign dispatch
- **Horizontal scaling** — add workers without touching application code

See [ADR-002](docs/adr/ADR-002-celery-redis-async-workers.md).

### Idempotency everywhere

- **Dispatch:** `idempotency_key = campaign_id:customer_id` on the `communications` table. A second enqueue on retry hits a UNIQUE constraint and no-ops.
- **Receipts:** Duplicate event detection checks `communication_events` before insert. Status transitions are forward-only — a late SENT event after DELIVERED is silently discarded.

### Materialized analytics

Rather than aggregating `communication_events` on every dashboard read (slow at scale), a Celery `update_analytics` task recomputes one `campaign_analytics` row per event. Dashboard reads are O(1) — a single JOIN. The tradeoff: a brief lag between event arrival and dashboard update (usually < 1 second).

See [ADR-003](docs/adr/ADR-003-materialized-analytics-pattern.md).

### Real-time with WebSockets, not polling

Each campaign gets a `ConnectionManager` subscription. After `db.commit()` on a receipt event, the analytics worker broadcasts to all subscribers. Connections are pruned on disconnect. This approach works for a single CRM instance; at scale it would move to Redis pub/sub for cross-instance fanout.

### AI model routing via OpenRouter

All AI calls go through OpenRouter pointing at Claude. This lets me swap models (Sonnet ↔ Haiku) per endpoint without changing application code — Haiku for low-latency NL→SQL, Sonnet for copilot reasoning and campaign generation.

See [ADR-004](docs/adr/ADR-004-ai-copilot-tool-calling.md).

---

## Scalability Analysis

### Current scope

- 10,000 customers · 50,000 orders — all queries sub-second with existing indexes
- Synchronous HTTP from CRM Celery worker to Channel Simulator — adequate for demo scale

### Bottlenecks at 10× (100K customers, 50+ concurrent campaigns)

| Bottleneck | Current approach | At 10× |
|------------|-----------------|--------|
| Campaign dispatch | Single Celery queue, HTTP per message | Partition by channel; replace HTTP with SQS/Kafka |
| Channel simulator | Celery on single node | Scale simulator horizontally; one node per channel type |
| Analytics recompute | Full aggregation on each event | Incremental Redis counters; flush to Postgres in batch |
| NL→SQL latency | ~1.5s Claude API call | Cache identical queries 30-min TTL in Redis |
| WebSocket broadcasting | In-memory `ConnectionManager` | Redis pub/sub for multi-instance fanout |
| Receipt ingestion | Single webhook endpoint | Batch webhook + idempotent Kafka consumer |

### Horizontal scaling path

```
Load Balancer
     │
     ├── CRM Instance 1 ──┐
     ├── CRM Instance 2   ├── PostgreSQL primary + read replica(s)
     └── CRM Instance 3 ──┘
              │
         Redis Pub/Sub ──▶ WebSocket broadcast across all instances
              │
         Celery Workers (auto-scale on queue depth via KEDA)
              │
         Channel Simulator Fleet
         (dedicated node per channel type for independent failure isolation)
```

**What I consciously did not build** for this scope: rate limiting on the receipt webhook, dead-letter queues for failed Celery tasks, read replicas, or Redis pub/sub for WebSocket — all clear next steps at production scale.

---

## Running Locally

### Docker Compose (recommended)

```bash
# 1. Configure
cp backend/.env.example backend/.env
# Set OPENROUTER_API_KEY in backend/.env

# 2. Start all 7 services
docker compose up -d

# 3. Run migrations + seed 10K customers + 50K orders
docker compose exec crm alembic upgrade head
docker compose exec crm python -m scripts.seed

# 4. Open http://localhost:3000
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL 15 |
| `redis` | 6379 | Redis 7 |
| `crm` | 8000 | FastAPI CRM API + WebSocket |
| `crm-worker` | — | Celery (campaigns + analytics queues) |
| `channel-simulator` | 8001 | Channel delivery simulator |
| `channel-worker` | — | Celery for delivery simulation |
| `frontend` | 3000 | Next.js 15 |

### Local Dev (no Docker)

```bash
# Prerequisites: PostgreSQL 15, Redis 7

# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL, REDIS_URL, OPENROUTER_API_KEY
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
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

### Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/astercrm
REDIS_URL=redis://localhost:6379/0
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
CHANNEL_SIMULATOR_URL=http://localhost:8001
CRM_WEBHOOK_URL=http://localhost:8000
```

---

## Tests

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest -v
```

| Test module | Coverage |
|-------------|---------|
| `test_customers.py` | CRUD, pagination, search, 409 on duplicate email |
| `test_segments.py` | NL creation (mocked AI), SQL safety blocklist |
| `test_campaigns.py` | Full lifecycle: create → AI generate → launch; double-launch rejection |
| `test_receipts.py` | Idempotency, forward-only status, bulk webhook, unknown comm 404 |
| `test_analytics.py` | Dashboard structure, insights endpoint, health check |
| `test_copilot.py` | Chat with and without history, AI error handling, validation |

---

## Deployment Guide

### Render + Neon + Vercel (recommended free tier path)

| Service | Platform | Notes |
|---------|----------|-------|
| PostgreSQL | Neon | Copy connection string → `DATABASE_URL` |
| Redis | Upstash or Render Redis add-on | |
| CRM API | Render web service (from `backend/`) | Set all env vars |
| CRM Worker | Render background worker | Same image; command: `celery -A app.core.celery_app worker -Q campaigns,analytics` |
| Channel Simulator | Render web service (from `channel-simulator/`) | |
| Channel Worker | Render background worker | Same image |
| Frontend | Vercel | Set `NEXT_PUBLIC_API_URL` to CRM service URL |

**Deploy order:** Postgres → Redis → CRM API (run `alembic upgrade head` in shell) → CRM Worker → Channel Simulator → Channel Worker → Frontend.

---

## Architecture Decision Records

| ADR | Decision | Rationale |
|-----|----------|-----------|
| [ADR-001](docs/adr/ADR-001-two-service-channel-architecture.md) | Two-service channel architecture | Mirrors real async delivery; forces proper callback handling |
| [ADR-002](docs/adr/ADR-002-celery-redis-async-workers.md) | Celery + Redis for async workers | Non-blocking dispatch; retry logic; independent queue scaling |
| [ADR-003](docs/adr/ADR-003-materialized-analytics-pattern.md) | Materialized analytics rows | O(1) dashboard reads vs slow event aggregation |
| [ADR-004](docs/adr/ADR-004-ai-copilot-tool-calling.md) | Claude tool-calling for copilot | Structured real operations, not just text responses |

---

## Tradeoffs I'd Change at Scale

1. **Webhook ingestion** — currently a synchronous FastAPI endpoint. At high volume I'd front it with a Kafka topic and have the analytics worker consume idempotently.
2. **NL→SQL caching** — identical queries hit the LLM every time. A 30-minute Redis cache keyed on the normalized query string would cut cost and latency significantly.
3. **WebSocket fanout** — the in-memory `ConnectionManager` doesn't work across multiple CRM instances. Redis pub/sub is the obvious fix.
4. **Campaign analytics** — I recompute the full row on each event. At volume, Redis HyperLogLog for deduplication + atomic counter increments would be faster, with a periodic flush to Postgres.
5. **Auth** — deliberately omitted for this assignment. Production would need JWT/session auth before the first PR merges.

---

<div align="center">

Built for the Xeno Engineering Take-Home Assignment · June 2026

</div>
