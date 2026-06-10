# ADR-003: Materialized Analytics Pattern for Campaign KPIs

**Status:** Accepted  
**Date:** 2026-06-10  
**Context:** Campaign analytics (delivery rate, open rate, CTR, conversion rate) must be fast to read but are derived from a high-write event stream.

---

## Context

Every message delivery fires a webhook event. A campaign with 10,000 recipients can generate 50,000–70,000 events (SENT + DELIVERED + OPENED + CLICKED + CONVERTED per message). 

Computing analytics on-the-fly at read time would require a multi-table JOIN + GROUP BY over potentially millions of rows on every dashboard load.

## Decision

Use a **materialized analytics pattern**:

1. `campaign_analytics` table stores one row per campaign with precomputed counters and rates
2. A Celery task (`update_campaign_analytics`) recomputes this row whenever a webhook event is received
3. Dashboard reads from `campaign_analytics` directly — O(1) per campaign

The recomputation query is a single SQL aggregation over `communication_events JOIN communications WHERE campaign_id = ?` — runs in ~5ms even at 50k events.

```sql
-- Example aggregation query (runs in Celery worker, not request path)
SELECT
    SUM(CASE WHEN event_type = 'SENT' THEN 1 ELSE 0 END) AS sent,
    SUM(CASE WHEN event_type = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered,
    ...
FROM communication_events e
JOIN communications c ON c.id = e.communication_id
WHERE c.campaign_id = :campaign_id
```

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| On-the-fly aggregation | Always accurate | Slow at scale; blocks dashboard |
| **Materialized row (Celery-updated)** ✓ | Sub-millisecond reads; async updates | Slight lag (eventual consistency) |
| Incremental counter updates | Even lower compute | Complex — must handle retries, race conditions |
| Streaming (Kafka + Flink) | Real-time, accurate | Over-engineered for this scale |

## Consequences

- **Good:** Dashboard analytics are always O(1) reads regardless of event volume.
- **Good:** The 5-retry policy on the analytics worker ensures counters eventually converge even under transient failures.
- **Acceptable trade-off:** Analytics are eventually consistent — typically 1–3 seconds behind the actual event stream. Acceptable for a marketing dashboard.
- **At scale:** Add a `last_updated_at` staleness indicator; alert if lag exceeds SLA (e.g., 30 seconds). At very high volume, move to stream processing.
