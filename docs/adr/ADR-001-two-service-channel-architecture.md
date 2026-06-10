# ADR-001: Two-Service Architecture for Channel Delivery

**Status:** Accepted  
**Date:** 2026-06-10  
**Context:** ShopperReach CRM needs to dispatch messages to customers and track delivery lifecycle events (SENT → DELIVERED → OPENED → READ → CLICKED → CONVERTED).

---

## Context

In real-world marketing infrastructure, the CRM is never directly responsible for channel delivery. WhatsApp Business API, SendGrid, and SMS providers operate asynchronously — they accept a send request and later fire webhook callbacks when the message is delivered, opened, or clicked.

We needed to model this accurately for the assignment and for production viability.

## Decision

Implement a **two-service architecture**:

1. **CRM Service** (port 8000) — the source of truth for customers, segments, campaigns, and analytics
2. **Channel Simulator** (port 8001) — a separate FastAPI + Celery service that accepts send requests and fires async callbacks back to the CRM

The callback loop:
```
CRM → POST /send (Channel Simulator)
            ↓ (async, Celery task)
Channel Simulator → POST /api/receipts/webhook (CRM)
```

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Monolith (simulate in-process) | Simpler | Doesn't model real-world async delivery; CRM would "know" delivery instantly |
| Message queue only (Kafka/SQS) | Production-grade | Over-engineered for demo; requires more infrastructure |
| **Two-service HTTP** ✓ | Mirrors real architecture; easy to swap simulator for real channel | Requires service discovery / env config |

## Consequences

- **Good:** Architecture directly mirrors what Xeno's real infra looks like. Channel providers can be swapped in by changing the simulator's callback logic.
- **Good:** CRM has no synchronous dependency on delivery — it learns via callbacks, enabling fire-and-forget dispatch at scale.
- **Trade-off:** Two Docker containers instead of one; CRM must be reachable from the simulator (handled via `CRM_RECEIPT_URL` env var).
- **At scale:** Replace synchronous HTTP from CRM to simulator with SQS/Kafka. Add circuit breakers and per-channel rate limiting.
