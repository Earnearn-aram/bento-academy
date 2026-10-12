---
id: R3
title: Stripe idempotent requests
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://docs.stripe.com/api/idempotent_requests
    page_last_updated: not shown
    redirected_to: no
  - url: https://docs.stripe.com/error-low-level
    page_last_updated: not shown
    redirected_to: no
---
## Q1. Header name, and which HTTP methods it applies to.
**Answer:** The header is `Idempotency-Key`.\[7\] Every `POST` request accepts it. Don't send it on `GET` or `DELETE`, where it has no effect because those methods are already idempotent.\[7\]\[8\]\[9\]
**Exact:** `Idempotency-Key: KG5LxwFBepaKHyUD` (from the page's curl example)\[7\]
**Where:** api/idempotent_requests; error-low-level → "Sending idempotency keys"
## Q2. How Stripe stores the result: does it replay the first response including errors (e.g. 500s)? Exceptions?
**Answer:** Yes. Stripe saves the status code and body of the first request for a given key, whether it succeeded or failed, and returns that same result for later requests with the key, including `500` errors. The exception: results are saved only once an endpoint has started executing. If the parameters fail validation, or the request clashes with another request running at the same time, nothing is saved and you can retry.\[7\]\[8\] The low-level page adds that a `429` can give a different result under the same key, because rate limiters run before the idempotency layer, and the same is true of a `401` with no API key and most `400`s for invalid parameters. A replayed response carries the header `Idempotent-Replayed: true`.\[9\]
**Exact:** "Subsequent requests with the same key return the same result, including `500` errors."; `Idempotent-Replayed: true`
**Where:** api/idempotent_requests; error-low-level → "Content errors", "Sending idempotency keys"
## Q3. How long keys are kept before they can be reused / are pruned.
**Answer:** Keys can be pruned once they are at least 24 hours old. Reusing a key after its original has been pruned starts a new request.\[7\]\[8\] The low-level page says the same thing as a guarantee: you can safely retry with the same key within 24 hours of first using it, and keys expire after 24 hours.\[9\]
**Exact:** "at least 24 hours old"; "keys expire out of the system after 24 hours"
**Where:** api/idempotent_requests; error-low-level → "POST requests"
## Q4. Same key reused with DIFFERENT parameters?
**Answer:** You get an error. The idempotency layer compares the new parameters with the original request's and rejects them if they differ.\[7\]
**Exact:** "errors if they're not the same to prevent accidental misuse"
**Where:** api/idempotent_requests; error-low-level → "Network errors"
## Q5. Two concurrent requests with same key?
**Answer:** If a request clashes with another one still running, its result is not saved and you can retry it.\[7\]\[8\] The status-code table describes `409 Conflict` as a request that "conflicts with another request (perhaps due to using the same idempotent key)."\[9\]
**Exact:** `409` Conflict
**Where:** api/idempotent_requests; error-low-level → "HTTP Status Code Reference"
## Q6. Recommended key format (e.g. V4 UUID) and max length.
**Answer:** Stripe suggests V4 UUIDs, or any other random string with enough entropy to avoid collisions. Keys can be up to 255 characters.\[8\] Don't put sensitive data such as email addresses in keys.\[7\] The low-level page also suggests deriving the key from your own object, such as a shopping cart ID, to block double submissions. Keys must be unique within your account for at least 24 hours.\[9\]
**Exact:** "up to 255 characters long"
**Where:** api/idempotent_requests; error-low-level → "Sending idempotency keys"
## Q7. From low-level errors page: which errors are safe to retry, and advice on backoff.
**Answer:**
- **Network errors** (socket errors, timeouts): retry with the same key and the same parameters until you get a definite answer.\[9\] This is the main reason idempotency keys exist.
- **4xx content errors:** fix the request and retry with a new key. The page calls a new key "the safest strategy" for 4xx.\[9\]
- **500s:** treat the result as indeterminate. Retrying with the same key returns the cached result. A new key is possible, but Stripe advises against it because the original attempt may have had side effects. Stripe reconciles these failures afterwards and may send webhooks for objects it creates during that reconciliation.\[9\]
- **`GET`/`DELETE`:** always safe to retry.\[9\]
- **`Stripe-Should-Retry` header:** `true` means retry, but wait first, probably on an exponential backoff. `false` means don't retry. If it's absent, decide from the status code.\[9\]
- **429:** use exponential backoff.\[9\]

The official libraries retry once quickly and then back off exponentially, but only if you turn this on (Ruby: `Stripe.max_network_retries = 2`).\[9\]
**Exact:** `Stripe-Should-Retry`; "We recommend an exponential backoff of your requests" (429 row)
**Where:** error-low-level → "Network errors", "Server errors", "The Stripe-Should-Retry header", "HTTP Status Code Reference"
## Official code samples (only if a question asked for one)
None requested.
## Could not verify
- No "last updated" date on either page.
## Surprises
- The wording "You can remove keys from the system automatically after they're at least 24 hours old" makes pruning sound like something you do.\[7\] Read it as Stripe pruning keys after 24 hours or more, which is how the low-level page phrases it.
- The behaviour described here is for API v1. In Stripe's v2 API overview (not one of the listed pages, so not used for answers), v2 retries failed requests\[10\] and also accepts keys on DELETE.\[10\] Check which API version you're on.

## Review
- **Verdict:** accepted.
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **Scope:** everything here is Stripe API **v1**. Say "in Stripe's API (v1)" when teaching it.
- **Applied:** the Defend question in API basics, lesson 5 (Safe to retry): "How do you make a POST safe to retry?"
- **Follow-ups:** none.

## Footnotes (numbering kept from the original export)

7. [idempotent requests](https://docs.stripe.com/api/idempotent_requests)
8. [Idempotent requests](https://docs.stripe.com/api/idempotent_requests?lang=node)
9. <https://docs.stripe.com/error-low-level>
10. [API v2 overview](https://docs.stripe.com/api-v2-overview?lang=dotnet)
