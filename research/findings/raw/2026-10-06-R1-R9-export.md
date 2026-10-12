# Bento Academy Research Findings R1–R9 (read 2026-10-06)

All nine requests are answered from the official pages, with a few gaps you should know about. The three biggest: the jitter formulas on the AWS blog are images, not text, so they could not be copied; the Builders' Library URL now redirects to a different site (builder.aws.com); and the Stripe pages do not say whether an endpoint that keeps failing gets disabled.

## TL;DR
- **Stripe (R1–R3, R9):** The earlier values check out against the live pages: 5-minute default signature tolerance, `Idempotency-Key` up to 255 characters, keys prunable after 24 hours, retries for up to three days in live mode and three times over a few hours in a sandbox, and the events list limited to the last 30 days. Two Stripe questions are NOT FOUND ON PAGE: a webhook timeout number, and whether failing endpoints get disabled or emailed. A different Stripe page (Billing subscriptions webhooks) says Stripe sends an email when a webhook is failing; nothing on Stripe's docs says endpoints are auto-disabled.
- **AWS (R4):** The Builders' Library article now redirects off-site to builder.aws.com (published Jun 12 2026, modified Jun 15 2026). The blog's Full, Equal and Decorrelated jitter pseudocode exists only as images. The blog's conclusion is that "Equal Jitter" loses and that choosing between "Full" and "Decorrelated" is "less clear".
- **RFCs and nginx (R5–R8):** Everything was verified on rfc-editor.org and nginx.org. Notable: RFC 9112 is shown as updated by RFC 9931 (March 2026, "Security Considerations for Optimistic Protocol Transitions in HTTP/1.1"), which changes only CONNECT handling, not §6 or §7. Per the NGINX Community Blog (Mar 24 2026), nginx 1.29.7, released March 2026, made HTTP/1.1 with keep-alive the default for proxying. RFC 9110 had to be read in pieces because the HTML page was too large to fetch in one go.

## How to use this
Each block below is one finding file, ready to save as `research/findings/<ID>.md`. Exact strings are in backticks. Anything the page does not state is marked **NOT FOUND ON PAGE**.

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

---
id: R2
title: Stripe webhook delivery, retries, ordering, best practices
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://docs.stripe.com/webhooks
    page_last_updated: not shown
    redirected_to: no
  - url: https://docs.stripe.com/webhooks/process-undelivered-events
    page_last_updated: not shown
    redirected_to: no
---
## Q1. What response the endpoint must return and how fast (any timeout number?).
**Answer:** Return a `2xx` status quickly, before any complex logic that could cause a timeout. The page's example is that you must return `200` before marking an invoice paid in your accounting system. Redirects (`3xx`) count as failures. The page lists "(Timed out) ERR" as a delivery status but gives no timeout value. Stripe requires TLS 1.2 or higher.\[1\]
**Exact:** NOT FOUND ON PAGE (no timeout number)
**Where:** webhooks → "Quickly return a 2xx response"; "Fix HTTP status codes"
## Q2. Should handler do work before or after returning 2xx? Does Stripe recommend queue/async?
**Answer:** Do the work after returning 2xx. Yes, Stripe recommends processing events through an asynchronous queue, because handling them synchronously can hit scaling problems during spikes. The page's example is the start of the month, when all subscriptions renew. A queue lets you process at a rate your system can handle.\[1\]
**Exact:** "Configure your handler to process incoming events with an asynchronous queue."\[1\]
**Where:** webhooks → "Handle events asynchronously"
## Q3. Retry schedule: how long and how often in live mode vs test/sandbox mode; exponential backoff?
**Answer:** In live mode, Stripe retries for up to three days with exponential backoff.\[3\] In a sandbox, it retries three times over a few hours.\[4\]\[5\] The page does not give exact intervals; you can see the next retry time in the endpoint's **Event deliveries** tab.\[5\] If the destination is disabled or deleted when a retry is due, future retries of that event stop. If you disable and then re-enable it before the retry, retries continue. Manual resends are possible from the Dashboard for up to 15 days after the event was created, and from the CLI (`stripe events resend <event_id> --webhook-endpoint=<endpoint_id>`) for up to 30 days. A manual resend that succeeds does **not** cancel the automatic retries.\[1\]
**Exact:** "for up to three days with an exponential back off in live mode"; "three times over the course of a few hours"
**Where:** webhooks → "Automatic retries", "Manual retries"
## Q4. What happens to an endpoint that keeps failing (disabled? emails?).
**Answer:** NOT FOUND ON PAGE. Neither listed page says whether Stripe disables a failing endpoint or sends an email. For context only (not a listed page, so it is not the answer): the search-index text of docs.stripe.com/billing/subscriptions/webhooks says that in live mode Stripe keeps retrying a failing endpoint for up to 3 days with exponential backoff, and "We'll also send you an email to notify you that the webhook is failing." My fetch of that page cut off before this section, so this wording comes from a search snippet. Automatic disabling is described only by third parties, not by Stripe's docs, so disabling remains not found.
**Where:** webhooks → "Event delivery behaviors" (checked, not stated)
## Q5. Duplicate events: can events be delivered more than once? Which ID to log to dedupe?
**Answer:** Yes. The same event can arrive more than once, so log the event IDs you have processed and skip any you have seen. Sometimes Stripe creates two separate Event objects for the same thing; to catch those, use the ID of the object in `data.object` together with `event.type`. Do not use `created` to decide whether you have already processed an event, because it is recorded in seconds and different events can share a value.\[1\]
**Exact:** event `id`; for separate duplicate Event objects, `data.object` id + `event.type`
**Where:** webhooks → "Handle duplicate events", "Event ordering"
## Q6. Event ordering: guaranteed? What is recommended instead?
**Answer:** Order is not guaranteed. Do not build your endpoint around a particular order. If you need data that hasn't arrived yet, fetch the missing objects from the API. For example, if `invoice.paid` arrives first, retrieve the invoice, charge and subscription. Track event IDs instead of relying on `created`.\[1\]
**Exact:** "Stripe doesn't guarantee the delivery of events in the order that they're generated."\[1\]
**Where:** webhooks → "Event ordering"
## Q7. Subscribe only to needed event types? Advice on CSRF exemption?
**Answer:** Yes, subscribe only to the event types your integration needs. Stripe advises against listening to extra events or all events, because it puts undue strain on your server. On CSRF: if your framework (Rails, Django and others) requires a CSRF token on every POST, it may block real webhook calls, and you may need to exempt the webhook route. The page includes a Rails example using `protect_from_forgery except: :webhook`.\[1\]
**Where:** webhooks → "Only listen to event types your integration requires"; "Exempt webhook route from CSRF protection"
## Q8. Advice on HTTPS, IP allow-listing, rolling secrets.
**Answer:** HTTPS: required in live mode. Your server needs a valid certificate, and only TLS v1.2 and v1.3 are supported. Registered endpoints must be public HTTPS URLs, though plain HTTP is fine for local development. IP allowlisting: Stripe sends webhooks from a published list of IP addresses (docs.stripe.com/ips). The page tells you to use the allowlist together with signature verification. Rolling secrets: roll them periodically, or when you suspect one has leaked, from the Workbench Webhooks tab.\[1\] You can keep the old secret alive for up to 24 hours.\[1\]
**Exact:** "Use both of these protections"
**Where:** webhooks → "Receive events with an HTTPS server", "Verify events are sent from Stripe", "Roll endpoint signing secrets periodically"
## Q9. How to replay/fetch missed events (process-undelivered-events page): which API, how far back.
**Answer:** Call the List Events API (`GET /v1/events`) with three parameters: `ending_before` set to the event just before the outage, `types[]` for the event types you want, and `delivery_success=false`. By default it returns up to 10 events, so use auto-pagination to get all of them.\[3\] Using `ending_before` with auto-pagination returns events in chronological order. Only events from the last 30 days are returned.\[3\] Track each event as processing/processed in your database so you don't handle it twice.\[6\] Stripe still treats manually processed events as undelivered and keeps retrying them, so when one comes back, return 2xx to stop the retries.\[3\]
**Exact:** "Stripe only returns events created in the last 30 days."\[3\]
**Where:** process-undelivered-events → "List webhook events", "Process the events", "Respond to automatic retries"
## Official code samples (only if a question asked for one)
None requested.
## Could not verify
- No timeout number for webhook responses.
- Whether failing endpoints get disabled or trigger email alerts (Q4). A non-listed Stripe page (billing/subscriptions/webhooks, seen only as a search snippet) mentions an email when a webhook is failing; nothing on Stripe's docs mentions auto-disabling.
## Surprises
- A manual resend that succeeds does not stop the automatic retries, and Stripe keeps retrying events you processed through the API.\[1\]\[3\] Your handler must be idempotent on event ID.
- The page warns that `created` is in seconds and can collide,\[1\] which rules out a common "order by created" shortcut.
- You can register at most 16 webhook endpoints.\[1\]

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

---
id: R4
title: AWS timeouts, retries, backoff with jitter
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
    page_last_updated: "Published Jun 12, 2026; Last modified Jun 15, 2026 (as shown on redirected page)"
    redirected_to: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter (canonical; different host, AWS Builder Center)
  - url: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    page_last_updated: "Published 04 MAR 2015; modified 2023-05-03 (page metadata; 'Update (May 2023)' banner)"
    redirected_to: no
---
## Q1. How AWS chooses timeout values (percentile approach).
**Answer:** Set a timeout on every remote call, and generally on every cross-process call even on the same machine; this covers both the connection timeout and the request timeout. To pick a value, start from the downstream service's latency metrics. Choose an acceptable rate of false timeouts, for example 0.1%, and use the matching latency percentile, here p99.9.\[11\] The article lists four caveats:
- Over the internet, allow for a reasonable worst-case network latency.\[11\]
- When p99.9 is close to p50, add some padding.\[11\]
- Linux `SO_RCVTIMEO` is not a good end-to-end socket timeout.\[11\]
- Make sure the timeout covers DNS and TLS handshakes.\[11\]

The worked example is a 20 ms timeout that fired after deployments because TLS connection setup was counted inside it. AWS fixed it by setting up connections at process start, before the process took traffic.\[11\]
**Exact:** "acceptable rate of false timeouts (such as 0.1%)"; "p99.9 in this example"
**Where:** Builders' Library → "Timeouts"
## Q2. Why retries are "selfish" and can amplify load; what they say about retrying at multiple layers.
**Answer:** A retry spends more of the server's time to raise the client's own chance of success. That's fine when failures are rare. When failures come from overload, retries add load, can make things much worse, and can delay recovery. On layers: in a five-deep call stack with three tries at each layer, load on the database rises 243x. AWS's practice is to retry at a single point in the stack.\[11\]
**Exact:** "the load on the database will increase 243x"; "our best practice is to retry at a single point in the stack"\[11\]
**Where:** Builders' Library → "Retries and backoff"
## Q3. Advice on limiting retries (token bucket / retry budget, max attempts).
**Answer:**
- Use capped exponential backoff, and limit the number of retries so that failures are handled earlier.\[11\]
- Instead of circuit breakers, which bring modal behaviour that is hard to test, rate-limit retries locally with a token bucket. Every call can retry while tokens remain; after that, retries happen at a fixed rate. This has been built into the AWS SDK since 2016.\[11\]
- Retry only when the dependency looks healthy, and stop when retries aren't improving availability.\[11\]

The article gives no fixed maximum number of attempts.
**Exact:** "limiting retries locally using a token bucket"; "AWS added this behavior to the AWS SDK in 2016."\[11\]
**Where:** Builders' Library → "Retries and backoff", "Conclusion"
## Q4. Copy the jitter formulas/pseudocode from the blog: "Full Jitter", "Equal Jitter", "Decorrelated Jitter", and which one the blog concludes is best.
**Answer:** The formulas could not be copied: the blog shows them only as images (figures 3, 6, 10 and 11), and the page text contains none of them. Per Rule 2 this is NOT FOUND ON PAGE as text. The text around the images does say:
- **Full Jitter** is the jittered sleep from the "Adding Jitter" section.\[12\]
- **Equal Jitter** "always keep[s] some of the backoff and jitter by a smaller amount", to prevent very short sleeps.\[12\]
- **Decorrelated Jitter** is "similar to 'Full Jitter', but we also increase the maximum jitter based on the last random value."\[12\]\[13\]

Conclusion: no-jitter backoff is "the clear loser", and of the jittered versions "Equal Jitter" loses. Between Decorrelated and Full the call is "less clear": Full Jitter does less work but takes slightly more time. Both cut client work and server load substantially.\[12\] The blog does not name a single winner.
**Exact:** NOT FOUND ON PAGE (as text; formulas are images)
**Where:** blog → "Adding Backoff", "Adding Jitter"
## Q5. Which operations are safe to retry (idempotency).
**Answer:** APIs with side effects are not safe to retry unless they are idempotent. Read-only APIs usually are idempotent. Resource-creation APIs may not be. Some APIs, like EC2 `RunInstances`, offer token-based idempotency so they can be retried safely. HTTP client errors (4xx) shouldn't be retried unchanged, while server errors (5xx) may succeed later. Eventual consistency blurs that line.\[11\]
**Where:** Builders' Library → "Retries and backoff" ("Deciding when to retry", "Knowing which failures are worth retrying")
## Official code samples (only if a question asked for one)
The jitter pseudocode is on the page only as images (blog figures 3, 6, 10, 11), so no text could be copied verbatim. Someone needs to look at the images and type the formulas in by hand.
## Could not verify
- The verbatim Full, Equal and Decorrelated formulas, because they are images. The simulator code is on GitHub (`aws-arch-backoff-simulator`),\[12\] but that is not the listed page, so it was not used.
- The Builders' Library URL redirects to a different host (builder.aws.com),\[11\] which goes slightly beyond Rule 1's "same site". It is AWS's official page. The author is Marc Brooker, Senior Principal Engineer at AWS, per the AWS Architecture Blog post "re:Invent 2019: Introducing the Amazon Builders' Library (Part I)". The article first appeared with the Builders' Library launch at re:Invent 2019, so the Jun 2026 date on builder.aws.com is a re-hosting date, not the original publication date.
## Surprises
- The Builders' Library article now lives on the AWS Builder Center with a 2026 publish date,\[11\] even though the content is the long-standing version.
- The blog's May 2023 banner says most AWS SDKs already do exponential backoff with jitter in "standard" or "adaptive" retry modes.\[12\]
- The article says to jitter all timers and periodic jobs, and to use a jitter that is the same each time on a given host rather than random, so problems show up as patterns.\[11\]

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

---
id: R8
title: nginx buffering of streamed responses
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://nginx.org/en/docs/http/ngx_http_proxy_module.html
    page_last_updated: not shown
    redirected_to: no
---
## Q1. Default value of proxy_buffering and what it does to a streamed response.
**Answer:** The default is `on`. With buffering on, nginx reads the upstream response as fast as it can into `proxy_buffer_size` and `proxy_buffers`, and can spill to a temp file on disk (limited by `proxy_max_temp_file_size`, default `1024m`).\[28\] So a streamed response can be held back instead of reaching the client as it is produced. With `off`, nginx passes data to the client immediately as it arrives, reading at most `proxy_buffer_size` at a time.\[28\]
**Exact:** `proxy_buffering on;`
**Where:** #proxy_buffering
## Q2. What the X-Accel-Buffering response header does and its allowed values.
**Answer:** The upstream can switch buffering on or off for a single response by sending this header. You can stop nginx from honouring it with `proxy_ignore_headers`. By default nginx doesn't pass `X-Accel-...` headers on to the client.\[28\]
**Exact:** `X-Accel-Buffering: yes` / `X-Accel-Buffering: no`
**Where:** #proxy_buffering, #proxy_ignore_headers, #proxy_hide_header
## Q3. Default proxy_read_timeout and what happens to a long-lived SSE stream that is silent longer than that.
**Answer:** The default is 60 seconds. The timeout applies between two successive reads, not to the whole response. If the upstream sends nothing for that long, nginx closes the connection.\[28\] So an SSE stream that goes silent for more than 60 seconds gets cut off unless the server sends something in between (an inference: e.g. a comment heartbeat) or you raise the timeout.
**Exact:** `proxy_read_timeout 60s;`; "If the proxied server does not transmit anything within this time, the connection is closed."\[28\]
**Where:** #proxy_read_timeout
## Official code samples (only if a question asked for one)
None requested.
## Could not verify
- The page shows no "last updated" date or nginx version.
## Surprises
- `proxy_http_version` now defaults to `1.1` (since 1.29.7). Per the NGINX Community Blog (Nick Shadrin, Mar 24 2026), version 1.29.7, released March 2026, changed the default for proxying to HTTP/1.1 with keep-alive, and you can go back with `proxy_http_version 1.0; proxy_set_header Connection "Close";`. Older advice to set the version explicitly therefore depends on which nginx you run.
- `proxy_limit_rate` works only when buffering is on.\[28\]

---
id: R9
title: Stripe pagination
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://docs.stripe.com/api/pagination
    page_last_updated: not shown
    redirected_to: "no (read as https://docs.stripe.com/api/pagination?cat=-1)"
---
## Q1. Parameter names (limit, starting_after, ending_before), limit range and default.
**Answer:** `limit` is optional, defaults to 10 and ranges from 1 to 100. `starting_after` is an object ID; pass the last ID you received to get the next page. `ending_before` is an object ID; pass the first ID you received to get the previous page. The two cursors are mutually exclusive. Results are in reverse chronological order.\[29\]
**Exact:** "default is 10"; "ranging between 1 and 100"
**Where:** api/pagination → "Parameters"
## Q2. Response fields (has_more, data, …).
**Answer:** The response contains four fields:
- `object`: always `"list"`.\[29\]
- `data`: an array of results.\[29\]
- `has_more`: a boolean; `false` means this is the end of the list.\[29\]
- `url`: the URL for this list.\[29\]
**Where:** api/pagination → "List Response Format"
## Q3. Does the page explain why cursor (object ID) pagination instead of offset?
**Answer:** NOT FOUND ON PAGE. The page says the list methods use cursor-based pagination,\[29\] but gives no reason for choosing cursors over offsets.\[30\]
**Where:** api/pagination (intro)
## Official code samples (only if a question asked for one)
None requested.
## Could not verify
- No "last updated" date.
## Surprises
- Endpoints under `/v2` use a different pagination interface. Search endpoints use `page` / `next_page` instead.\[29\]\[30\]

## Sources

1. [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks)
2. [https://docs.stripe.com/webhooks/signature.md](https://docs.stripe.com/webhooks/signature.md)
3. [process undelivered events](https://docs.stripe.com/webhooks/process-undelivered-events)
4. [Status transitions and finalization](https://docs.stripe.com/invoicing/integration/workflow-transitions)
5. [Manage event destinations](https://docs.stripe.com/workbench/event-destinations)
6. [process undelivered events](https://edge-docs.stripe.com/webhooks/process-undelivered-events)
7. [idempotent requests](https://docs.stripe.com/api/idempotent_requests)
8. [Idempotent requests](https://docs.stripe.com/api/idempotent_requests?lang=node)
9. <https://docs.stripe.com/error-low-level>
10. [API v2 overview](https://docs.stripe.com/api-v2-overview?lang=dotnet)
11. [Timeouts, retries, and backoff with jitter | AWS Builder Center](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter)
12. [Exponential Backoff And Jitter | Amazon Web Services](https://aws.amazon.com/blogs//architecture/exponential-backoff-and-jitter/)
13. [Exponential Backoff and Jitter](https://www.elasticdog.com/Exponential-Backoff-and-Jitter)
14. <https://www.rfc-editor.org/rfc/rfc6455.html>
15. [RFC 9112: HTTP/1.1 | RFC Editor](https://www.rfc-editor.org/info/rfc9112/)
16. [rfc9110.notprepped.xml](https://www.rfc-editor.org/prerelease/rfc9110.notprepped.xml)
17. [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/info/rfc9110/)
18. [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
19. [rfc9110.xml](https://www.rfc-editor.org/rfc/rfc9110.xml)
20. [RFC9110](https://httpwg.org/specs/rfc9110)
21. [RFC 6585: Additional HTTP Status Codes | RFC Editor](https://rfc-editor.org/rfc/rfc6585)
22. [422 Unprocessable Entity: what it means and how to fix it](https://www.host-tracker.com/en/learn/http-status-codes/422-unprocessable-content)
23. [Fix FastAPI 422 Unprocessable Entity: 6 Causes and Fixes · DebugAI Blog](https://debugai.io/blog/fix-fastapi-422-unprocessable-entity)
24. [RFC 7519: JSON Web Token (JWT) | RFC Editor](https://www.rfc-editor.org/rfc/rfc7519?session_ref=direct)
25. [RFC 8725: JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
26. [RFC 8725 JSON Web Token Best Current Practices Abstract](https://www.rfc-editor.org/rfc/rfc8725.pdf)
27. [JSON Web Token Best Current Practices](https://www.ietf.org/archive/id/draft-ietf-oauth-rfc8725bis-02.html)
28. [Module ngx\_http\_proxy\_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
29. [docs.stripe.com](https://docs.stripe.com/api/pagination?cat=-1)
30. [stripe.com](https://stripe.com/docs/idempotency)
