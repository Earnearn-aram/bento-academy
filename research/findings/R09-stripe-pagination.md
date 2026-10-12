---
id: R9
title: Stripe pagination
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://docs.stripe.com/api/pagination
    page_last_updated: not shown
    redirected_to: "no (read as https://docs.stripe.com/api/pagination?cat=-1)"
---
## Q1. Parameter names (limit, starting_after, ending_before), limit range and default.
**Answer:** `limit` is optional, defaults to 10 and ranges from 1 to 100. `starting_after` is an object ID; pass the last ID you received to get the next page. `ending_before` is an object ID; pass the first ID you received to get the previous page. The two cursors are mutually exclusive. Results are in reverse chronological order.\[29\]
**Exact:** "default is 10"; "ranging between 1 and 100"
**Where:** api/pagination → "Parameters"
## Q2. Response fields (has_more, data, …).
**Answer:** The response contains four fields:
- `object`: always `"list"`.\[29\]
- `data`: an array of results.\[29\]
- `has_more`: a boolean; `false` means this is the end of the list.\[29\]
- `url`: the URL for this list.\[29\]
**Where:** api/pagination → "List Response Format"
## Q3. Does the page explain why cursor (object ID) pagination instead of offset?
**Answer:** NOT FOUND ON PAGE. The page says the list methods use cursor-based pagination,\[29\] but gives no reason for choosing cursors over offsets.\[30\]
**Where:** api/pagination (intro)
## Official code samples (only if a question asked for one)
None requested.
## Could not verify
- No "last updated" date.
## Surprises
- Endpoints under `/v2` use a different pagination interface. Search endpoints use `page` / `next_page` instead.\[29\]\[30\]

## Review
- **Verdict:** accepted.
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **Gap:** Stripe doesn't explain *why* it uses cursors. The lesson's reason (offsets skip or repeat items when rows are added while you page) is our own explanation, and the lesson labels it that way.
- **Follow-ups:** none.

## Footnotes (numbering kept from the original export)

29. [docs.stripe.com](https://docs.stripe.com/api/pagination?cat=-1)
30. [stripe.com](https://stripe.com/docs/idempotency)
