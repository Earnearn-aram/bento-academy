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

## Review
- **Verdict:** accepted.
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **Not from the listed page:** the claim "nginx 1.29.7 made HTTP/1.1 the proxy default" comes from the NGINX Community Blog, not nginx.org docs. Treat it as unverified until R10 Q3 confirms it from nginx.org.
- **Follow-ups:** R10 Q3.

## Footnotes (numbering kept from the original export)

28. [Module ngx\_http\_proxy\_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
