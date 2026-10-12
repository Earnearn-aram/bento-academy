---
id: R1
title: Stripe webhook signature verification
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://docs.stripe.com/webhooks
    page_last_updated: not shown
    redirected_to: no
  - url: https://docs.stripe.com/webhooks/signature
    page_last_updated: not shown
    redirected_to: "the page exists; it is titled 'Resolve webhook signature verification errors' (read via https://docs.stripe.com/webhooks/signature.md)"
---
## Q1. Exact name and format of the signature header (layout of t= and v1= parts); give one example value from the page.
**Answer:** The header is `Stripe-Signature`.\[1\] It holds a timestamp with a `t=` prefix, followed by one or more signatures, each with a scheme prefix: `v` plus an integer. The only valid live scheme is `v1`. Test events also carry a fake `v0` signature. The elements are separated by commas, and the real header is a single line (the page adds newlines only for readability).\[1\]
**Exact:** `t=1492774577,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd,v0=6ffbb59b2300aae63f272406069a9788598b792a944a07aba816edb039989a39`. The troubleshooting page gives the shape as `t=xxx,v1=yyy,v0=zzz`.\[1\]\[2\]
**Where:** webhooks → "Verify webhook signatures manually"; signature page → "Check the signature"
## Q2. Exactly what string is signed (how timestamp and payload are joined).
**Answer:** The signed string, called `signed_payload`, is the timestamp as a string, then a literal `.`, then the raw JSON request body.\[1\]
**Exact:** `signed_payload = <timestamp> + "." + <raw request body>`
**Where:** webhooks → "Step 2: Prepare the signed_payload string"
## Q3. Which HMAC hash function, and how the result is encoded (hex/base64).
**Answer:** HMAC with SHA-256. The key is the endpoint's signing secret and the message is `signed_payload`.\[1\] The page does not name the encoding. The sample `v1` value is 64 lowercase hex characters, which points to hex, but that is an inference from the example, not a statement on the page.
**Exact:** `HMAC` with `SHA-256`
**Where:** webhooks → "Verify webhook signatures manually", "Step 3: Determine the expected signature"
## Q4. Why the raw request body must be used (what the page says about frameworks that parse/re-serialize JSON).
**Answer:** Stripe verifies the signature against the exact bytes it sent, so any change to the body breaks verification.\[1\] The troubleshooting page says some frameworks add or remove whitespace, reorder key-value pairs, convert the string to JSON, or change the encoding, and all of these cause verification to fail. The body must be the UTF-8 string Stripe sent, unchanged. For Express, put `app.use(express.json())` after the webhook route.\[2\] The page also gives tips for Next.js App Router, Pages Router (disable `bodyParser` and use `buffer(request)`), Body Parser, and an AWS API Gateway mapping template that exposes `rawBody`.\[2\]
**Exact:** "Any manipulation to the raw body of the request causes the verification to fail."\[1\]
**Where:** webhooks → "Don't manipulate the raw body request"; signature page → "Retrieve the raw request body"
## Q5. Default timestamp tolerance used by official libraries, and what it protects against.
**Answer:** The default tolerance is 5 minutes and can be changed with an extra parameter. It protects against replay attacks, where an attacker re-sends a captured valid payload and signature. The timestamp is inside the signed payload, so it cannot be changed without breaking the signature. The page also says to keep server clocks synced with NTP, and never to use a tolerance of `0`, because that disables the recency check entirely. Every retry gets a fresh timestamp and signature.\[1\]
**Exact:** "Our libraries have a default tolerance of 5 minutes between the timestamp and the current time."\[1\]
**Where:** webhooks → "Preventing replay attacks"
## Q6. What happens with multiple v1 signatures (secret rotation / rolling secrets); how long both secrets stay valid.
**Answer:** When you roll an endpoint secret, you can expire the old one immediately or keep it active for up to 24 hours. While more than one secret is active, Stripe sends one signature per secret, so the header carries several `v1` values.\[1\] Your code should accept the event if any of them matches.
**Exact:** "delay its expiration for up to 24 hours"; "Stripe generates one signature per secret until expiration."
**Where:** webhooks → "Roll endpoint signing secrets periodically" and "Verify webhook signatures manually"
## Q7. Does the page recommend constant-time comparison? Quote the line if yes.
**Answer:** Yes.
**Exact:** "To protect against timing attacks, use a constant-time-string comparison to compare the expected signature to each of the received signatures."\[1\]
**Where:** webhooks → "Step 4: Compare the signatures"
## Q8. The official "verify manually" numbered steps, in own words.
**Answer:**
1. Split the header on `,`, then split each element on `=`. Keep `t` (the timestamp) and every `v1` value, and drop everything else, including `v0`. Ignoring non-`v1` schemes also prevents downgrade attacks.\[1\]
2. Build `signed_payload` as the timestamp, a `.`, and the raw body.\[1\]
3. Compute HMAC-SHA256 of `signed_payload`, keyed with the endpoint secret.\[1\]
4. Compare your result to each received `v1` signature using a constant-time comparison. If one matches, check that the gap between now and the timestamp is within your tolerance.\[1\]
**Where:** webhooks → "Verify webhook signatures manually", Steps 1–4
## Official code samples (only if a question asked for one)
None requested.
## Could not verify
- The page does not say whether the signature is hex or base64. Hex is inferred from the example only.
- Neither page shows a "last updated" date.
## Surprises
- In the first example handler (the "Snapshot event handler"), the code sets `status 400` when verification fails but has no `return`, so it goes on to process the unverified event. The handler in the "Verify with official libraries" section does return.\[1\] Do not copy the first one as-is.
- Stripe now tells you to use both IP allowlisting and signature verification ("Use both of these protections").\[1\]
- The UI is now called "Workbench" (it replaces the Developers Dashboard),\[1\] so menu paths in older tutorials may not match.

## Review
- **Verdict:** accepted.
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **How to teach the gap:** the page never says "hex". Say "the example signature is 64 hex characters", not "Stripe uses hex".
- **Watch out:** don't copy the first example handler from the page. It sets 400 but keeps going (see Surprises).
- **Follow-ups:** none.

## Footnotes (numbering kept from the original export)

1. [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks)
2. [https://docs.stripe.com/webhooks/signature.md](https://docs.stripe.com/webhooks/signature.md)
