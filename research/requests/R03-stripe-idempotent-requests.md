---
id: R3
title: Stripe idempotent requests
priority: high
status: applied
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R03-stripe-idempotent-requests.md
needed_for:
  - API basics: Safe to retry (Defend)
  - Webhooks: idempotency
  - Resilient APIs: Retries with backoff
used_by:
  - api-fundamentals/safe-to-retry
---

# R3: Stripe idempotent requests

Pages:
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/error-low-level (section on idempotency / safe retries)

Questions:
1. Header name, and which HTTP methods it applies to (POST only? GET/DELETE?).
2. How Stripe stores the result: does it replay the first response, including errors (e.g. 500s)? Exceptions?
3. How long keys are kept before they can be reused / are pruned.
4. What happens if the same key is reused with DIFFERENT parameters.
5. What happens if two requests with the same key arrive at the same time (concurrent).
6. Recommended key format (e.g. V4 UUID) and max length.
7. From the low-level errors page: which errors are safe to retry, and their advice on backoff.
