---
id: R2
title: Stripe webhook delivery, retries, ordering, best practices
priority: high
status: reviewed
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R02-stripe-webhook-delivery.md
needed_for:
  - Webhooks: ack fast, retries, duplicates, ordering
used_by: []
---

# R2: Stripe webhook delivery, retries, ordering, best practices

Pages:
- https://docs.stripe.com/webhooks (sections on best practices, retries, duplicates, order of events, responding quickly)
- https://docs.stripe.com/webhooks/process-undelivered-events

Questions:
1. What response the endpoint must return and how fast (any timeout number?).
2. Should the handler do the work before or after returning 2xx? What does Stripe recommend (queue? async?)
3. Retry schedule: for how long and how often Stripe retries in live mode vs test/sandbox mode. Do they use exponential backoff?
4. What happens to an endpoint that keeps failing (disabled? emails?).
5. Duplicate events: does Stripe say events can be delivered more than once? What does it recommend to dedupe (which ID to log)?
6. Event ordering: is order guaranteed? What does it recommend instead?
7. Does it recommend only subscribing to needed event types? Any advice on CSRF exemption for the endpoint?
8. Any advice on HTTPS, IP allow-listing, or rolling secrets.
9. How to replay / fetch missed events (from the "process undelivered events" page): which API, and how far back.
