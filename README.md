# ShopperReach CRM — AI-Native Customer Engagement Platform

An AI-native mini CRM built for the Xeno Engineering Assignment. Enables brands to discover audiences, create personalised campaigns, launch communications, and track engagement — all accelerated by AI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend (3000)               │
│  Dashboard · Customers · Segments · Campaigns · Copilot │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────┐
│              FastAPI CRM Service (8000)                  │
│  /customers /orders /segments /campaigns /receipts       │
│  /analytics /copilot                                     │
├──────────────┬──────────────────────┬───────────────────┤
│  PostgreSQL  │  Redis               │  Celery Workers   │
│  (data)      │  (cache/queue)       │  campaigns+analytics│
└──────────────┴──────────┬───────────┴───────────────────┘
                          │ HTTP POST /send
┌─────────────────────────▼───────────────────────────────┐
│         Channel Simulator Service (8001)                 │
│  Simulates SENT→DELIVERED→OPENED→READ→CLICKED→CONVERTED  │
│  Async Celery worker with realistic channel profiles     │
└─────────────────────────┬───────────────────────────────┘
                          │ POST /api/receipts/webhook
                          └────────────────▶ CRM (event loop)
```

**Two-service callback loop:** CRM dispatches to Channel Simulator → simulator fires async events back → CRM ingests and updates analytics in real-time.

---

## Features

- **Customer & Order Ingestion** — REST API + CSV import, paginated list with search
- **AI Segment Builder** — Natural language → SQL → audience (e.g. "fashion buyers who haven't purchased in 60 days")
- **Campaign Engine** — Draft → Launch lifecycle with Celery-backed dispatch
- **Channel Simulator** — Realistic delivery/open/click/convert simulation with per-channel probability profiles
- **Webhook Receipt Processing** — Idempotent event ingestion, forward-only status upgrades, async analytics update
- **Analytics Dashboard** — Funnel, radar chart, KPI cards, revenue trend
- **AI Copilot** — Claude-powered chat with tool calling: create segments, build campaigns, fetch analytics, launch campaigns

---

## Quick Start (Docker Compose)

```bash
# 1. Clone and configure
cp backend/.env.example backend/.env
# Edit backend/.env — add your OPENROUTER_API_KEY

# 2. Start everything
docker compose up -d

# 3. Seed data (2000 customers, ~10k orders, smart segments)
docker compose exec crm python -m scripts.seed

# 4. Open http://localhost:3000
```

### Local Dev (no Docker)

```bash
# Prerequisites: PostgreSQL, Redis

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers with pagination + search |
| POST | `/api/customers` | Create customer |
| POST | `/api/customers/import/csv` | Bulk import via CSV |
| GET | `/api/segments` | List segments |
| POST | `/api/segments/from-nl` | Create segment from natural language |
| POST | `/api/campaigns/generate` | AI-generate campaign details |
| POST | `/api/campaigns` | Create campaign |
| POST | `/api/campaigns/{id}/launch` | Launch campaign (dispatches to channel) |
| GET | `/api/campaigns/{id}/analytics` | Campaign funnel metrics |
| GET | `/api/analytics/dashboard` | Global dashboard stats |
| POST | `/api/copilot` | AI copilot chat with tool calling |
| POST | `/api/receipts/webhook` | Callback endpoint for channel events |
| POST | `/api/receipts/webhook/bulk` | Bulk event ingestion |

---

## System Design Decisions

### Why two services?
Mirrors real-world channel delivery architecture. The CRM doesn't know *when* messages are delivered — it learns via callbacks. This decouples dispatch from tracking and allows the simulator to model realistic async delays.

### Idempotency
Each communication has a `campaign_id:customer_id` idempotency key. The receipt handler skips duplicate events (except CLICKED/CONVERTED which can happen multiple times).

### Analytics update strategy
Rather than computing analytics on every read (slow at scale), we use a Celery task to recompute a materialized `campaign_analytics` row on each event. At higher scale, this would move to a stream processor (Kafka + Flink).

### NL → SQL
We send the natural language description to Claude with strict schema context and request only a WHERE clause. The backend validates against a blocklist of dangerous DDL keywords before executing.

### AI Copilot tool loop
Standard Claude tool-calling loop with up to 5 iterations. Tools: `create_segment`, `create_campaign`, `launch_campaign`, `get_analytics`, `list_segments`.

### Scale tradeoffs
- **Current:** synchronous HTTP calls from CRM to channel simulator; works for demo scale
- **At scale:** replace with message queue (SQS/Kafka), fan-out workers, circuit breakers, rate limiting per channel

---

## Deployment (Render + Neon + Vercel)

1. **Database:** Create a Neon PostgreSQL database. Copy the connection string into `DATABASE_URL`.
2. **Redis:** Use Render's Redis add-on or Upstash.
3. **CRM Service:** Deploy `backend/` on Render as a web service. Set env vars from `.env`.
4. **CRM Worker:** Deploy same image as a background worker with command `celery -A app.core.celery_app worker -Q campaigns,analytics`.
5. **Channel Simulator:** Deploy `channel-simulator/` as a separate web service + worker.
6. **Frontend:** Deploy `frontend/` on Vercel. Set `NEXT_PUBLIC_API_URL` to your CRM service URL.

---

## AI-Native Workflow

This project was built AI-natively using Claude Code (this tool). Key AI contributions:
- Architecture planning and service boundary decisions
- Full backend implementation from schema → service → route layers
- Frontend component generation with Tailwind + Recharts
- Prompt engineering for NL→SQL and campaign generation
- Code review and edge case identification

The AI copilot embedded in the product uses Claude via OpenRouter with function calling to perform real CRM actions in response to natural language.
