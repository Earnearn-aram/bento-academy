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

## Review
- **Verdict:** accepted with gaps.
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **Gaps:**
  - No webhook timeout number. Teach "ack within a few seconds; the docs give no number" and mark it as our advice.
  - Whether failing endpoints get disabled is not on the page. Don't claim it either way. The "email when failing" line came from a search snippet only, so don't use it.
- **Sources to treat with care:** footnotes 4–6 are Stripe pages too (Invoicing, Workbench, and the edge-docs mirror of a listed page). They're fine as official, but they weren't on the request list.
- **Follow-ups:** R10 Q5.

## Footnotes (numbering kept from the original export)

1. [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks)
3. [process undelivered events](https://docs.stripe.com/webhooks/process-undelivered-events)
4. [Status transitions and finalization](https://docs.stripe.com/invoicing/integration/workflow-transitions)
5. [Manage event destinations](https://docs.stripe.com/workbench/event-destinations)
6. [process undelivered events](https://edge-docs.stripe.com/webhooks/process-undelivered-events)
