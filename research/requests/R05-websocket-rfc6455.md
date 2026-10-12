---
id: R5
title: RFC 6455 (The WebSocket Protocol)
priority: medium
status: reviewed
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R05-websocket-rfc6455.md
needed_for:
  - WebSocket module
used_by: []
---

# R5: RFC 6455 (The WebSocket Protocol)

Page: https://www.rfc-editor.org/rfc/rfc6455 (or https://datatracker.ietf.org/doc/html/rfc6455)

Questions:
1. Sec. 1.3 / 4.2.2: the exact GUID used to compute `Sec-WebSocket-Accept`, and the computation (SHA-1 then base64?).
2. Sec. 4.2.1: which request headers the server must check; what the server returns if the handshake is invalid (status code).
3. Sec. 5.5.2 / 5.5.3: rules for Ping and Pong (must a Pong echo the Ping data? are unsolicited Pongs allowed? max control-frame payload size).
4. Sec. 5.1: why client-to-server frames are masked, server-to-client are not (one sentence).
5. Sec. 7.4.1: meaning of close codes 1000, 1001, 1003, 1006, 1007, 1008, 1009, 1011; which codes must never be sent in a Close frame.
6. Sec. 10.2: what the RFC says about checking the `Origin` header.
