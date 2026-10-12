---
id: R5
title: RFC 6455 WebSocket
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://www.rfc-editor.org/rfc/rfc6455 (read as https://www.rfc-editor.org/rfc/rfc6455.html)
    page_last_updated: "not shown (RFC dated December 2011)"
    redirected_to: no
---
## Q1. Sec. 1.3 / 4.2.2: the exact GUID used to compute Sec-WebSocket-Accept, and the computation (SHA-1 then base64?).
**Answer:** Yes, SHA-1 then base64. Take the client's `Sec-WebSocket-Key` value exactly as sent (still base64-encoded, leading and trailing whitespace trimmed), append the GUID, take the SHA-1 hash (20 bytes), and base64-encode it. The server does not need to decode the key.\[14\]
**Exact:** GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`; example key `dGhlIHNhbXBsZSBub25jZQ==` → accept `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`\[14\]
**Where:** §1.3, §4.2.2 step 5.4
## Q2. Sec. 4.2.1: which request headers the server must check; what the server returns if handshake invalid (status code).
**Answer:** The server must check for:
- an HTTP/1.1 or later GET request
- `Host`
- `Upgrade` containing `websocket` (case-insensitive)
- `Connection` including the token `Upgrade` (case-insensitive)
- `Sec-WebSocket-Key`, which must decode to 16 bytes
- `Sec-WebSocket-Version: 13`

`Origin`, `Sec-WebSocket-Protocol` and `Sec-WebSocket-Extensions` are optional. If the handshake doesn't match, the server must stop processing and return an appropriate HTTP error such as 400 Bad Request. §4.2.2 adds 403 for an unwanted origin, 404 for an unknown resource, and 426 Upgrade Required with a `Sec-WebSocket-Version` header for an unsupported version.\[14\]
**Exact:** "(such as 400 Bad Request)"
**Where:** §4.2.1, §4.2.2
## Q3. Sec. 5.5.2 / 5.5.3: Ping/Pong rules (must Pong echo Ping data? unsolicited Pongs allowed? max control-frame payload size).
**Answer:** When an endpoint receives a Ping, it must send a Pong unless it has already received a Close, and it should do so as soon as practical. The Pong must carry the same application data as the Ping. If several Pings arrive before you've answered, you may reply only to the latest. Unsolicited Pongs are allowed and act as a one-way heartbeat; no reply is expected. All control frames carry 125 bytes of payload or less and must not be fragmented.\[14\]
**Exact:** "payload length of 125 bytes or less"; "must have identical 'Application data'"; "A Pong frame MAY be sent unsolicited."
**Where:** §5.5, §5.5.2, §5.5.3
## Q4. Sec. 5.1: why client-to-server frames are masked and server-to-client are not (one sentence).
**Answer:** Clients mask their frames so that a malicious script can't control the bytes on the wire and make them look like an HTTP request, which could poison caching proxies. Server-to-client data isn't masked because forging a fake response would also require forging a request (see §10.3). Servers must close the connection if they receive an unmasked frame, and clients must close it if they receive a masked one.\[14\]
**Where:** §5.1, §10.3
## Q5. Sec. 7.4.1: meaning of close codes 1000, 1001, 1003, 1006, 1007, 1008, 1009, 1011; which codes must never be sent in a Close frame.
**Answer:**
- 1000: normal closure; the purpose of the connection has been fulfilled.\[14\]
- 1001: going away, for example the server shutting down or the browser leaving the page.\[14\]
- 1003: received a type of data it can't accept, such as binary sent to a text-only endpoint.\[14\]
- 1006: reserved; means the connection closed abnormally, with no Close frame.\[14\]
- 1007: data inconsistent with the message type, such as non-UTF-8 in a text message.\[14\]
- 1008: policy violation; a generic code to use when nothing fits better or to hide details.\[14\]
- 1009: message too big to process.\[14\]
- 1011: the server hit an unexpected condition.\[14\]

Never send `1005`, `1006` or `1015` in a Close frame. `1004` is reserved, and `1010` is for clients only.\[14\]
**Exact:** `1005`, `1006`, `1015` "MUST NOT be set as a status code in a Close control frame"
**Where:** §7.4.1
## Q6. Sec. 10.2: what the RFC says about checking the Origin header.
**Answer:** A server meant to serve only certain sites, not any web page, should check that `Origin` is one it expects, and should answer an unacceptable one with HTTP 403 Forbidden. The check protects against malicious JavaScript running inside a trusted browser. It does not stop non-browser clients, which can send any `Origin` they like (§10.1).\[14\]
**Exact:** "SHOULD verify the |Origin| field is an origin they expect"; "403 Forbidden"
**Where:** §10.2, §10.1
## Official code samples (only if a question asked for one)
None requested.
## Could not verify
- Errata for RFC 6455 were not checked.
## Surprises
- §7.2.3 recommends reconnect backoff: a random first delay (0–5 seconds is reasonable), then truncated binary exponential backoff.\[14\]

## Review
- **Verdict:** accepted.
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **Good for tests:** the key/accept example (`dGhlIHNhbXBsZSBub25jZQ==` → `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`) is an official test vector. Use it in a test.
- **Follow-ups:** R10 Q4 (errata were not checked).

## Footnotes (numbering kept from the original export)

14. <https://www.rfc-editor.org/rfc/rfc6455.html>
