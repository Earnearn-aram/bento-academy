---
id: R6
title: HTTP semantics (RFC 9110), HTTP/1.1 (RFC 9112), RFC 6585
priority: medium
status: applied
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R06-http-semantics.md
needed_for:
  - API basics: lessons 3-5
  - Resilient APIs: One error shape, 502 vs 504
  - Streaming: chunked encoding
used_by:
  - api-fundamentals/get-is-safe
  - api-fundamentals/conflict-vs-invalid
  - api-fundamentals/safe-to-retry
---

# R6: HTTP semantics (RFC 9110), HTTP/1.1 (RFC 9112), RFC 6585

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
