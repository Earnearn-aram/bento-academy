---
id: R7
title: JWT: RFC 7519 and RFC 8725 (JWT Best Current Practices)
priority: medium
status: reviewed
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R07-jwt.md
needed_for:
  - Resilient APIs: JWT
used_by: []
---

# R7: JWT: RFC 7519 and RFC 8725 (JWT Best Current Practices)

Pages:
- https://www.rfc-editor.org/rfc/rfc7519
- https://www.rfc-editor.org/rfc/rfc8725

Questions:
1. RFC 7519 §4.1: the registered claims (`iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti`) — one line each.
2. RFC 8725 §2 + §3: the attacks listed (e.g. `alg: none`, algorithm confusion, weak HMAC keys) and the matching recommendations.
3. RFC 8725: what it says about validating `iss` and `aud`, and about key size / entropy for HMAC secrets.
4. RFC 8725: explicit typing (`typ`) — what and why, in one or two lines.
