# ADR-002: Celery + Redis for Async Task Processing

**Status:** Accepted  
**Date:** 2026-06-10  
**Context:** Campaign dispatch and analytics updates must not block the HTTP request-response cycle.

---

## Context

Launching a campaign against a 10,000-customer segment means enqueuing 10,000 HTTP calls to the channel simulator. Doing this synchronously inside a FastAPI endpoint would:
- Time out the HTTP request (default 30s)
- Block the server's thread pool
- Provide no retry capability on failure

Analytics updates triggered on every webhook event similarly must not slow down the receipt endpoint.

## Decision

Use **Celery with Redis** as the message broker and result backend, with two dedicated queues:

- `campaigns` queue — `dispatch_campaign` task iterates segment audience, sends to channel simulator
- `analytics` queue — `update_campaign_analytics` task recomputes materialized analytics row

Workers run as separate Docker containers (`crm-worker`, `channel-worker`).

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Background threads (FastAPI BackgroundTasks) | No extra infra | No retry; dies with worker; no distributed execution |
| **Celery + Redis** ✓ | Retry logic, distributed, observable | Requires Redis; adds operational complexity |
| Celery + RabbitMQ | More robust message delivery | Heavier; Redis sufficient at this scale |
| Dramatiq / ARQ | Simpler API | Less ecosystem support; fewer deployment examples |

## Consequences

- **Good:** Campaign dispatch is fully async with configurable retry (3 attempts, 30s back-off).
- **Good:** Analytics worker has 5-retry policy — eventual consistency guarantee even under temporary DB load.
- **Good:** Two queues allow independent scaling: if analytics falls behind, add analytics workers without touching campaign dispatch.
- **Trade-off:** Redis becomes a single point of failure for task queuing. Mitigated in production with Redis Sentinel or Upstash.
- **At scale:** Partition `campaigns` queue by channel type (one queue per channel), enabling per-channel concurrency control and rate limiting.
