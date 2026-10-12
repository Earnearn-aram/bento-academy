---
id: R10
title: Follow-ups from R1–R9 (gaps to close)
priority: medium
status: requested
asked_on: 2026-10-12
answered_on:
finding:
needed_for:
  - API basics: lesson 4 (409 wording)
  - Resilient APIs: JWT, One error shape
  - WebSocket module
  - Webhooks module
  - Streaming / SSE behind a proxy
used_by: []
---

# R10: Follow-ups from R1–R9 (gaps to close)

Short questions left open by the first round. One page per question. Same rules as always (see `research/README.md`).

Pages and questions:
1. **https://www.rfc-editor.org/rfc/rfc9110.html §15.5.10 (409).** Copy the first two sentences exactly. (R6 only had them from a pre-release XML file.)
2. **https://www.rfc-editor.org/rfc/rfc7518 §3.2 (HMAC with SHA-2).** What minimum key size does it require for `HS256`? Quote the sentence.
3. **https://nginx.org/en/CHANGES** (or the changes page for the 1.29 line). In which version did the default of `proxy_http_version` change to `1.1`? Quote the change line. (R8 only had this from the NGINX Community Blog.)
4. **https://www.rfc-editor.org/errata/rfc6455.** Is there any verified erratum for §4 (handshake), §5.5 (control frames) or §7.4 (close codes)? List the erratum IDs and give one line each.
5. **https://docs.stripe.com/webhooks** (and only official Stripe pages it links to). Is there any official statement on (a) how long Stripe waits for your response before treating it as timed out, and (b) whether Stripe disables an endpoint that keeps failing? If not, write NOT FOUND ON PAGE.
6. **https://www.rfc-editor.org/rfc/rfc9110.html §15.6.4 (503).** Does it still say a server is not required to use 503 when it's overloaded? Quote the sentence if so.
