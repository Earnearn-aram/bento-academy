# Research requests for bento-academy

**For:** a research agent (or a person) with normal internet access.
**Why this exists:** the course is being built in a sandbox that cannot open
these sites. Every other source for the course (FastAPI, Starlette, Pydantic,
MDN, HTTPX, pytest, websockets, GitHub webhook docs, Python docs, WHATWG,
Anthropic docs, OWASP cheat sheets) is already reachable and does NOT need research.

## Rules for the researcher

1. Use only the official page listed (or the page it redirects to on the same
   site). If a listed URL is dead, find the current official page on the same
   site and say so. Do not use blogs, Stack Overflow, or AI summaries.
2. Answer every question. If the page does not answer it, write
   `NOT FOUND ON PAGE` — do not fill the gap from memory.
3. Write answers in your own words. Short exact quotes (max ~25 words) are
   welcome ONLY for things that must be exact: header names, string formats,
   numbers, defaults, code. Put them in backticks or a quote block.
4. Copy official code samples verbatim when asked (they are small).
5. Record the date you read the page and any "last updated" date shown on it.
6. One output file per request, saved as `research/findings/<ID>.md`, using the
   template at the bottom. Then commit them to the repo, or paste them into the chat.

## Priority

| ID | Topic | Needed for | Priority |
|----|-------|-----------|----------|
| R1 | Stripe webhook signatures | Lesson 5.2 | High |
| R2 | Stripe webhook delivery, retries, ordering, best practices | Lessons 5.1, 5.3–5.5 | High |
| R3 | Stripe idempotent requests | Lessons 5.3, 5.6, 1.4 | High |
| R4 | AWS: timeouts, retries, backoff with jitter | Lesson 1.4 | High |
| R5 | RFC 6455 (WebSocket protocol) | Module 4 | Medium |
| R6 | RFC 9110 / 9112 / 6585 (HTTP semantics, chunked) | Lessons 1.1, 1.5, 2.3 | Medium |
| R7 | JWT RFCs 7519 + 8725 | Lesson 1.7 | Medium |
| R8 | nginx proxy buffering for streaming | Lessons 2.3, 3.2 | Low |
| R9 | Stripe pagination | Lesson 1.6 | Low |

---

## R1 — Stripe webhook signature verification

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

## R2 — Stripe webhook delivery, retries, ordering, best practices

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

## R3 — Stripe idempotent requests

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

## R4 — AWS: timeouts, retries, and backoff with jitter

Pages:
- https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

Questions:
1. How AWS chooses timeout values (the percentile approach).
2. Why retries are "selfish" and can amplify load; what they say about retrying at multiple layers.
3. Their advice on limiting retries (token bucket / retry budget, max attempts).
4. Copy the jitter formulas from the blog: "Full Jitter", "Equal Jitter", "Decorrelated Jitter", and which one the blog concludes is best.
5. What they say about which operations are safe to retry (idempotency).

## R5 — RFC 6455 (The WebSocket Protocol)

Page: https://www.rfc-editor.org/rfc/rfc6455 (or https://datatracker.ietf.org/doc/html/rfc6455)

Questions:
1. Sec. 1.3 / 4.2.2: the exact GUID used to compute `Sec-WebSocket-Accept`, and the computation (SHA-1 then base64?).
2. Sec. 4.2.1: which request headers the server must check; what the server returns if the handshake is invalid (status code).
3. Sec. 5.5.2 / 5.5.3: rules for Ping and Pong (must a Pong echo the Ping data? are unsolicited Pongs allowed? max control-frame payload size).
4. Sec. 5.1: why client-to-server frames are masked, server-to-client are not (one sentence).
5. Sec. 7.4.1: meaning of close codes 1000, 1001, 1003, 1006, 1007, 1008, 1009, 1011; which codes must never be sent in a Close frame.
6. Sec. 10.2: what the RFC says about checking the `Origin` header.

## R6 — HTTP semantics (RFC 9110), HTTP/1.1 (RFC 9112), RFC 6585

Pages:
- https://www.rfc-editor.org/rfc/rfc9110
- https://www.rfc-editor.org/rfc/rfc9112
- https://www.rfc-editor.org/rfc/rfc6585

Questions:
1. RFC 9110 §9.2.1–9.2.2: definition of safe and idempotent methods; list which methods are idempotent.
2. RFC 9110 §15.5.2 (401): what the server MUST send with a 401.
3. RFC 9110 §15.5.10 (409) and §15.5.21 (422): when each is meant to be used.
4. RFC 9110 §15.6.4 (503) and §10.2.3 (Retry-After): both value formats for Retry-After.
5. RFC 6585 §4 (429): what it says about Retry-After and about how to identify the user.
6. RFC 9112 §7.1: the exact chunked encoding format (chunk-size in hex, CRLF, last-chunk `0`, trailers). Copy the ABNF block.
7. RFC 9112 §6.3: what happens when both Content-Length and Transfer-Encoding are present (why it matters: request smuggling).

## R7 — JWT: RFC 7519 and RFC 8725 (JWT Best Current Practices)

Pages:
- https://www.rfc-editor.org/rfc/rfc7519
- https://www.rfc-editor.org/rfc/rfc8725

Questions:
1. RFC 7519 §4.1: the registered claims (`iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti`) — one line each.
2. RFC 8725 §2 + §3: the attacks listed (e.g. `alg: none`, algorithm confusion, weak HMAC keys) and the matching recommendations.
3. RFC 8725: what it says about validating `iss` and `aud`, and about key size / entropy for HMAC secrets.
4. RFC 8725: explicit typing (`typ`) — what and why, in one or two lines.

## R8 — nginx buffering of streamed responses (Low)

Page: https://nginx.org/en/docs/http/ngx_http_proxy_module.html (directives `proxy_buffering`, `proxy_read_timeout`) and the `X-Accel-Buffering` header (same page).

Questions:
1. Default value of `proxy_buffering` and what it does to a streamed response.
2. What the `X-Accel-Buffering` response header does and its allowed values.
3. Default `proxy_read_timeout` and what happens to a long-lived SSE stream that is silent longer than that.

## R9 — Stripe pagination (Low)

Page: https://docs.stripe.com/api/pagination

Questions:
1. Parameter names (`limit`, `starting_after`, `ending_before`), limit range and default.
2. Response fields (`has_more`, `data`, …).
3. Does the page explain why cursor (object ID) pagination instead of offset?

---

## Output template (one file per request: `research/findings/<ID>.md`)

~~~markdown
---
id: R1
title: Stripe webhook signature verification
researcher: <name or agent>
read_on: 2026-10-05
sources:
  - url: https://docs.stripe.com/webhooks
    page_last_updated: <date shown on page, or "not shown">
    redirected_to: <url, or "no">
---

## Q1. <copy the question>
**Answer:** <your own words>
**Exact:** `<header / format / number, only if needed>`
**Where:** <section heading on the page, or URL#anchor>

## Q2. ...
**Answer:** NOT FOUND ON PAGE

## Official code samples (only if a question asked for one)
```<lang>
<verbatim>
```

## Could not verify
- <anything missing, contradictory, or behind a login>

## Surprises
- <anything on the page that contradicts common advice or seems version-specific>
~~~
