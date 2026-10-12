---
id: R1
title: Stripe webhook signature verification
priority: high
status: reviewed
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R01-stripe-webhook-signatures.md
needed_for:
  - Webhooks: verify signatures
used_by: []
---

# R1: Stripe webhook signature verification

Pages:
- https://docs.stripe.com/webhooks (section on verifying signatures / "Verify webhook signatures")
- https://docs.stripe.com/webhooks/signature (if it exists / redirects)

Questions:
1. Exact name and format of the signature header (e.g. how `t=` and `v1=` parts are laid out). Give one example value from the page.
2. Exactly what string is signed (how the timestamp and the payload are joined).
3. Which HMAC hash function, and how the result is encoded (hex? base64?).
4. Why the raw request body must be used (what the page says about frameworks that parse/re-serialize JSON).
5. Default timestamp tolerance used by the official libraries, and what it protects against.
6. What happens with multiple `v1` signatures (secret rotation / rolling secrets). How long both secrets stay valid.
7. Does the page recommend constant-time comparison? Quote the line if yes.
8. Copy the official "verify manually" steps (the numbered list) in your own words.
