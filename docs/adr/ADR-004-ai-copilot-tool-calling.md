# ADR-004: AI Copilot with Tool Calling (Agentic Loop)

**Status:** Accepted  
**Date:** 2026-06-10  
**Context:** The assignment requires an AI copilot that helps marketers "think, decide, and act" — not just answer questions.

---

## Context

A simple Q&A chatbot would not satisfy the requirement of an "AI-native" CRM. Xeno explicitly evaluates whether the AI can perform real CRM actions in response to natural language: creating segments, building campaigns, and launching them.

The challenge is designing a safe agentic loop where AI can take multi-step actions while:
- Not running unintended actions
- Handling tool failures gracefully
- Presenting results clearly

## Decision

Implement a **Claude tool-calling loop** with:

1. **6 registered tools:** `create_segment`, `create_campaign`, `launch_campaign`, `get_analytics`, `list_segments`, `plan_workflow`
2. **Up to 5 iterations** per user message (prevents infinite loops)
3. **`plan_workflow` as a safe pre-action step** — returns a plan JSON with `requires_approval: true` before executing, enabling human-in-the-loop
4. All tools execute real CRM operations through the same service layer used by REST endpoints

```
User: "Increase purchases from dormant users"
    ↓
AI calls plan_workflow(goal="...")
    ↓
Returns: {segment definition, campaign brief, channel recommendation, steps[]}
    ↓
User reviews and approves
    ↓
AI calls create_segment → create_campaign → launch_campaign
    ↓
"Done! Campaign launched to 1,847 dormant customers via WhatsApp."
```

## Model Choice: Claude via OpenRouter

Using `claude-sonnet-4-5` (via OpenRouter) because:
- Best-in-class tool calling reliability vs GPT-4 in internal testing
- OpenRouter provides unified API access with fallback models
- Cost-effective for interactive chat (tool calls are token-efficient)

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Simple Q&A (no tools) | Simpler | Doesn't perform CRM actions; not "AI-native" |
| LangChain agents | Rich ecosystem | Heavy abstraction; harder to debug; less control |
| **Native tool calling** ✓ | Direct control; transparent; testable | Requires explicit tool schema definition |
| Fully autonomous (no approval) | Seamless | Risky — could launch unintended campaigns |

## Consequences

- **Good:** AI can perform genuine multi-step CRM workflows in response to natural language.
- **Good:** `plan_workflow` tool enables human-in-the-loop for high-stakes actions (launching campaigns).
- **Good:** Tools reuse existing service layer — no duplication, same validation rules apply.
- **Trade-off:** Each tool call adds latency (~1–2s). Mitigated by streaming responses (future improvement).
- **Safety:** NL→SQL for segments runs through `_make_safe()` DDL blocklist before execution.
