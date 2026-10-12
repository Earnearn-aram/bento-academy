---
id: R9
title: Stripe pagination
priority: low
status: reviewed
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R09-stripe-pagination.md
needed_for:
  - Resilient APIs: Pages that never skip
used_by: []
---

# R9: Stripe pagination

Page: https://docs.stripe.com/api/pagination

Questions:
1. Parameter names (`limit`, `starting_after`, `ending_before`), limit range and default.
2. Response fields (`has_more`, `data`, …).
3. Does the page explain why cursor (object ID) pagination instead of offset?
