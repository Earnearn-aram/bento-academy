---
id: R8
title: nginx buffering of streamed responses
priority: low
status: reviewed
asked_on: 2026-10-05
answered_on: 2026-10-06
finding: findings/R08-nginx-buffering.md
needed_for:
  - Streaming / SSE behind a proxy
used_by: []
---

# R8: nginx buffering of streamed responses

Page: https://nginx.org/en/docs/http/ngx_http_proxy_module.html (directives `proxy_buffering`, `proxy_read_timeout`) and the `X-Accel-Buffering` header (same page).

Questions:
1. Default value of `proxy_buffering` and what it does to a streamed response.
2. What the `X-Accel-Buffering` response header does and its allowed values.
3. Default `proxy_read_timeout` and what happens to a long-lived SSE stream that is silent longer than that.
