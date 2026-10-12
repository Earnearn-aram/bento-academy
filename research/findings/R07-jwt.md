---
id: R7
title: JWT (RFC 7519, RFC 8725)
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://www.rfc-editor.org/rfc/rfc7519
    page_last_updated: "not shown (May 2015). Banner: 'This RFC was updated, see RFC 7797, RFC 8725'"\[24\]
    redirected_to: https://www.rfc-editor.org/info/rfc7519/ (canonical, same site)
  - url: https://www.rfc-editor.org/rfc/rfc8725 (read as https://www.rfc-editor.org/rfc/rfc8725.html)
    page_last_updated: "not shown (February 2020; BCP 225)"\[25\]
    redirected_to: no
---
## Q1. RFC 7519 §4.1: registered claims (iss, sub, aud, exp, nbf, iat, jti) — one line each.
**Answer:** All of these are optional; each application decides which ones it requires.\[24\]
- `iss`: who issued the token. A case-sensitive StringOrURI.\[24\]
- `sub`: who the token is about. It must be unique within the issuer or globally.\[24\]
- `aud`: who the token is meant for. A recipient that doesn't find itself in `aud`, when `aud` is present, MUST reject the token. It is usually an array, or a single string if there is one audience.\[24\]
- `exp`: the token MUST NOT be accepted on or after this time. A NumericDate; a small clock-skew leeway is allowed.\[24\]
- `nbf`: the token MUST NOT be accepted before this time. A NumericDate; leeway is allowed.\[24\]
- `iat`: when the token was issued, which tells you its age. A NumericDate.\[24\]
- `jti`: a unique token ID that must not collide, including across issuers. Can be used to prevent replay.\[24\]
**Where:** RFC 7519 §4.1.1–§4.1.7
## Q2. RFC 8725 §2 + §3: attacks listed (alg: none, algorithm confusion, weak HMAC keys) and matching recommendations.
**Answer:**
- **`alg: none`** (§2.1): an attacker sets `alg` to "none" and some libraries accept the token without checking any signature. **Algorithm confusion** (§2.1): `RS256` is changed to `HS256`, and the library verifies the HMAC using the RSA *public* key as the shared secret (CVE-2015-9235). Fix (§3.1): the caller must be able to specify the allowed algorithms, and the library must not use any others. The library must check that `alg`/`enc` matches the algorithm actually used. Each key MUST be used with exactly one algorithm, and this must be checked. Fix (§3.2): allow only current algorithms. Use "none" only when the token is protected by other means, such as TLS end to end, and libraries SHOULD NOT create or accept "none" unless the caller explicitly asks.\[25\]\[26\]
- **Weak HMAC keys** (§2.2): keys with too little entropy, such as human-memorable passwords, can be brute-forced offline once an attacker has a token. Fix (§3.5): follow RFC 7515 §10.1 and RFC 7518 §8.8. Human-memorizable passwords MUST NOT be used directly as `HS256` keys.\[25\]
- **Other attacks:** §2 also covers bad encryption/signature composition (§3.3), ciphertext-length leakage (§3.6), invalid elliptic-curve points (§3.4), JSON encodings other than UTF-8 (§3.7),\[26\] substitution and cross-JWT confusion (§3.8, §3.9, §3.11, §3.12), and injection or SSRF through `kid`, `jku` and `x5u` (§3.10).\[25\]
**Exact:** "each key MUST be used with exactly one algorithm"; "human-memorizable passwords MUST NOT be directly used as the key to a keyed-MAC algorithm such as 'HS256'"
**Where:** RFC 8725 §2.1, §2.2, §3.1, §3.2, §3.5
## Q3. RFC 8725: validating iss and aud, and key size/entropy for HMAC secrets.
**Answer:** **iss** (§3.8): if `iss` is present, the application MUST check that the signing keys belong to that issuer, and reject the token if they don't; an example is OpenID Connect's `jwks_uri`.\[25\] If `sub` is present, it MUST be a valid subject, or issuer–subject pair, for the application. **aud** (§3.9): if one issuer serves more than one relying party, the token MUST contain `aud`, and the recipient MUST reject it if `aud` is missing or doesn't match. **Key size/entropy** (§3.5): the RFC gives no bit length. It defers to RFC 7515 §10.1 and RFC 7518 §8.8 and bans passwords as HMAC keys.\[25\]
**Exact:** Numeric HMAC key size: NOT FOUND ON PAGE
**Where:** RFC 8725 §3.8, §3.9, §3.5
## Q4. RFC 8725: explicit typing (typ) — what and why, one or two lines.
**Answer:** Put a specific type in the `typ` header, such as `secevent+jwt` (leaving off `application/`), and check it during validation. That way one kind of JWT can't be passed off as another. It is RECOMMENDED for new uses of JWTs. In a Nested JWT it must be on the inner token. It may not help tell apart older kinds of JWT whose rules never checked `typ`.\[25\]
**Exact:** "Explicit typing is RECOMMENDED for new uses of JWTs."
**Where:** RFC 8725 §3.11
## Official code samples (only if a question asked for one)
None requested.
## Could not verify
- A specific minimum HMAC key length. RFC 8725 defers to RFC 7515 and RFC 7518, which were not read.
## Surprises
- RFC 8725 says "none" can be "perfectly acceptable" when the token is protected end to end by other means.\[25\] That is softer than the usual "never accept none".
- An IETF draft to replace RFC 8725 ("rfc8725bis") showed up in search results.\[27\] It is not a published RFC and was not used, but RFC 8725 may be superseded soon.

## Review
- **Verdict:** accepted with one gap.
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **Gap:** no minimum HMAC key size. RFC 8725 defers to RFC 7518, which wasn't read. Until R10 answers, don't state a number.
- **Note:** an IETF draft (rfc8725bis) may replace RFC 8725. Check before building the JWT lesson.
- **Follow-ups:** R10 Q2.

## Footnotes (numbering kept from the original export)

24. [RFC 7519: JSON Web Token (JWT) | RFC Editor](https://www.rfc-editor.org/rfc/rfc7519?session_ref=direct)
25. [RFC 8725: JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
26. [RFC 8725 JSON Web Token Best Current Practices Abstract](https://www.rfc-editor.org/rfc/rfc8725.pdf)
27. [JSON Web Token Best Current Practices](https://www.ietf.org/archive/id/draft-ietf-oauth-rfc8725bis-02.html)
