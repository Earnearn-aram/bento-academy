---
id: R6
title: HTTP semantics (RFC 9110, 9112, 6585)
researcher: research agent (Claude) + subagent for RFC 9110 sections
read_on: 2026-10-06
sources:
  - url: https://www.rfc-editor.org/rfc/rfc9110
    page_last_updated: "not shown (RFC dated June 2022; STD 97); info page shows no 'updated by' in the part read"
    redirected_to: "the HTML page (https://www.rfc-editor.org/rfc/rfc9110.html) was too large to fetch whole; sections were read from https://www.rfc-editor.org/info/rfc9110/, rfc-editor.org XML copies, and rfc-editor.org search excerpts; .txt redirected www → rfc-editor.org"
  - url: https://www.rfc-editor.org/rfc/rfc9112 (read as https://www.rfc-editor.org/info/rfc9112/)
    page_last_updated: "not shown (June 2022; STD 99). Page banner: 'This RFC was updated, see RFC 9931'"\[15\]
    redirected_to: no
  - url: https://www.rfc-editor.org/rfc/rfc6585
    page_last_updated: "not shown (April 2012); 1 erratum listed"
    redirected_to: https://www.rfc-editor.org/info/rfc6585/ (canonical, same site)
---
## Q1. RFC 9110 §9.2.1–9.2.2: definition of safe and idempotent methods; list idempotent methods.
**Answer:** A method is **safe** if its defined meaning is essentially read-only: the client neither asks for nor expects any state change on the server, and normal use causes no harm.\[16\]\[17\] The server may still have side effects such as logging; the client just isn't accountable for them. GET, HEAD, OPTIONS and TRACE are safe.\[18\] A method is **idempotent** if several identical requests have the same intended effect as one. Idempotent methods: PUT, DELETE, and all the safe methods (GET, HEAD, OPTIONS, TRACE).\[18\] POST and CONNECT are neither safe nor idempotent.\[16\] A client should not automatically retry a non-idempotent request unless it knows the request is idempotent or never took effect, and a proxy must not.\[17\]\[18\]
**Exact:** "PUT, DELETE, and safe request methods are idempotent."
**Where:** RFC 9110 §9.2.1, §9.2.2
## Q2. §15.5.2 (401): what the server MUST send with a 401.
**Answer:** A `WWW-Authenticate` header containing at least one challenge for the target resource.\[17\]
**Exact:** "MUST send a WWW-Authenticate header field (Section 11.6.1) containing at least one challenge applicable to the target resource."
**Where:** RFC 9110 §15.5.2
## Q3. §15.5.10 (409) and §15.5.21 (422): when each is meant to be used.
**Answer:** **409 Conflict:** the request conflicts with the resource's current state, and the user may be able to resolve the conflict and resubmit. The server should include enough detail to show where the conflict comes from. It is most common with PUT, for example a versioning conflict with an earlier edit by someone else.\[16\]\[19\] **422 Unprocessable Content:** the server understands the content type, so 415 would be wrong, and the syntax is correct, but it can't carry out the instructions. The RFC's example is well-formed XML with semantically wrong instructions.\[19\] 422 moved into core HTTP from WebDAV.\[17\]\[20\]
**Exact:** `409 (Conflict)`; `422 (Unprocessable Content)`
**Where:** RFC 9110 §15.5.10, §15.5.21
## Q4. §15.6.4 (503) and §10.2.3 (Retry-After): both value formats for Retry-After.
**Answer:** A 503 means the server is temporarily unable to handle the request, because of overload or maintenance, and the problem will likely clear after some delay. The server MAY send `Retry-After`.\[19\] `Retry-After` takes either an HTTP-date or a whole number of seconds to wait. With a 503, it says how long the service is expected to be unavailable. With a 3xx, it is the minimum wait before following the redirect.\[18\]
**Exact:**
```
Retry-After = HTTP-date / delay-seconds
delay-seconds  = 1*DIGIT
Retry-After: Fri, 31 Dec 1999 23:59:59 GMT
Retry-After: 120
```
**Where:** RFC 9110 §15.6.4, §10.2.3
## Q5. RFC 6585 §4 (429): what it says about Retry-After and how to identify the user.
**Answer:** A 429 means the user sent too many requests in a given time (rate limiting). The response SHOULD explain the condition and MAY include `Retry-After` saying how long to wait; the example uses `Retry-After: 3600`. The RFC deliberately does not say how the server identifies the user or counts requests. It could count per resource, across the whole server, or across a group of servers, and identify the user by credentials or a stateful cookie. 429 responses MUST NOT be cached. §7.2 adds that servers don't have to send 429 at all; under attack, simply dropping connections may be better.\[21\]
**Exact:** "MAY include a Retry-After header"; "does not define how the origin server identifies the user"
**Where:** RFC 6585 §4, §7.2
## Q6. RFC 9112 §7.1: exact chunked encoding format (chunk-size in hex, CRLF, last-chunk 0, trailers). Copy the ABNF block.
**Answer:** Each chunk is a hex size, optional extensions, CRLF, then the data, then CRLF. The body ends with a zero-size last chunk, then an optional trailer section, then a final CRLF. Receivers must guard against integer overflow when parsing large hex sizes.\[15\]
**Exact:**
```
chunked-body   = *chunk
                 last-chunk
                 trailer-section
                 CRLF

chunk          = chunk-size [ chunk-ext ] CRLF
                 chunk-data CRLF
chunk-size     = 1*HEXDIG
last-chunk     = 1*("0") [ chunk-ext ] CRLF

chunk-data     = 1*OCTET ; a sequence of chunk-size octets
```
Trailer (§7.1.2): `trailer-section   = *( field-line CRLF )`
**Where:** RFC 9112 §7.1, §7.1.2
## Q7. RFC 9112 §6.3: what happens when both Content-Length and Transfer-Encoding are present (why it matters: request smuggling).
**Answer:** Transfer-Encoding wins over Content-Length. Such a message may be a request-smuggling or response-splitting attempt and ought to be handled as an error. An intermediary that forwards it must remove Content-Length and process Transfer-Encoding first. §6.1 adds that a server MAY reject such a request or process it using Transfer-Encoding alone, but either way it MUST close the connection afterwards. Senders must never send both headers (§6.2). If Transfer-Encoding is in a request but chunked isn't the final coding, the server must reply 400 and close. It matters because two parsers that frame the same bytes differently let an attacker hide a second request inside the first (§11.2).\[15\]
**Exact:** "the Transfer-Encoding overrides the Content-Length"; "ought to be handled as an error"
**Where:** RFC 9112 §6.3 item 3, §6.1, §6.2, §11.2
## Official code samples (only if a question asked for one)
Chunked ABNF is copied above (Q6).
## Could not verify
- RFC 9110's HTML page was too large to read whole (613,696 bytes). The quotes come from pieces of rfc-editor.org copies. The first two sentences of §15.5.10 (409) come only from a pre-publication XML file and should be checked against the HTML page.
- Whether RFC 9110 §15.6.4 keeps the older note that servers aren't required to use 503 when overloaded.
- RFC 9931 itself was not one of the listed pages, so it was not read directly. Per the enrichment check, RFC 9931 ("Security Considerations for Optimistic Protocol Transitions in HTTP/1.1", B. Schwartz, Proposed Standard, March 2026) updates RFC 9112 only for CONNECT: proxy servers MUST close the connection when rejecting a CONNECT request, and proxy clients acting for untrusted TCP clients MUST wait for a 2xx before forwarding payload or send `Connection: close`. It does not touch §6 or §7.
## Surprises
- RFC 9112's info page now says it was updated by RFC 9931.\[15\] Per that RFC's summary, the update covers CONNECT handling only, so the §6.3 and §7.1 answers above stand.
- RFC 9110 renamed 422 from "Unprocessable Entity" to "Unprocessable Content".\[22\]\[23\]

## Review
- **Verdict:** accepted with gaps.
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **Ignore:** footnotes 22 and 23 (host-tracker.com and debugai.io) are third-party blogs, which breaks Rule 1. The 422 rename they were cited for is in RFC 9110 itself (footnotes 18 and 20), so nothing is lost.
- **Gaps:** the first two sentences of 409 came from a pre-release XML file, so they need checking against the published HTML. Our lessons only use the gist ("clashes with the current state; say enough for the client to fix it"), which is safe either way.
- **Applied:**
  - API basics, lesson 3: "safe" now says the client doesn't *ask* for a change (the server may still log).
  - Lesson 4: 422's name is "Unprocessable Content", and a 409 should explain the clash.
  - Lesson 5: clients shouldn't auto-retry non-idempotent requests, and proxies must not.
  - Lessons 3–5 link RFC 9110 under Read more.
- **Follow-ups:** R10 Q1 and Q6.

## Footnotes (numbering kept from the original export)

15. [RFC 9112: HTTP/1.1 | RFC Editor](https://www.rfc-editor.org/info/rfc9112/)
16. [rfc9110.notprepped.xml](https://www.rfc-editor.org/prerelease/rfc9110.notprepped.xml)
17. [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/info/rfc9110/)
18. [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
19. [rfc9110.xml](https://www.rfc-editor.org/rfc/rfc9110.xml)
20. [RFC9110](https://httpwg.org/specs/rfc9110)
21. [RFC 6585: Additional HTTP Status Codes | RFC Editor](https://rfc-editor.org/rfc/rfc6585)
22. [422 Unprocessable Entity: what it means and how to fix it](https://www.host-tracker.com/en/learn/http-status-codes/422-unprocessable-content)
23. [Fix FastAPI 422 Unprocessable Entity: 6 Causes and Fixes · DebugAI Blog](https://debugai.io/blog/fix-fastapi-422-unprocessable-entity)
