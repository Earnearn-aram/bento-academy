---
id: R4
title: AWS: timeouts, retries, and backoff with jitter
priority: high
status: reviewed
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R04-aws-timeouts-retries-jitter.md
needed_for:
  - Resilient APIs: Timeouts
  - Resilient APIs: Retries with backoff
used_by: []
---

# R4: AWS: timeouts, retries, and backoff with jitter

Pages:
- https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

Questions:
1. How AWS chooses timeout values (the percentile approach).
2. Why retries are "selfish" and can amplify load; what they say about retrying at multiple layers.
3. Their advice on limiting retries (token bucket / retry budget, max attempts).
4. Copy the jitter formulas from the blog: "Full Jitter", "Equal Jitter", "Decorrelated Jitter", and which one the blog concludes is best.
5. What they say about which operations are safe to retry (idempotency).
