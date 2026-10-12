# Research

Some course facts come from pages this build sandbox can't open: Stripe, AWS, the RFCs and nginx. A research agent (or a person) with normal internet access reads those pages and writes down what they say. We then review the answer and use it in lessons. This folder keeps that work organized.

Sources the sandbox *can* read don't need a request. That covers FastAPI, Starlette, Pydantic, MDN, HTTPX, pytest, websockets, GitHub docs, the Python docs, WHATWG, Anthropic docs and OWASP.

## How it works

```
1. request    requests/R10-<slug>.md      we write the questions and the exact official pages
2. answer     findings/R10-<slug>.md      the researcher fills in TEMPLATE.md, one file per request
3. review     "## Review" in the finding  we check it against the rules, note gaps and what to ignore
4. apply      lessons cite it             meta.toml:  [[sources]] … research = "R10"
```

Each request's frontmatter records where it is: `status: requested → answered → reviewed → applied`. It also records `needed_for` (planned lessons) and `used_by` (lessons that already cite it).

`make check-content` keeps this honest. It checks that:
- every request and finding has the required frontmatter;
- every request past `requested` has a finding;
- every `research = "Rn"` cited by a lesson has a finding;
- every request is listed in the index below.

## Index

| ID | Topic | Status | Read on | Needed for | Open gaps |
|----|-------|--------|---------|------------|-----------|
| R1 | Stripe webhook signatures | reviewed | 2026-10-06 | Webhooks | hex encoding only implied |
| R2 | Stripe webhook delivery, retries, ordering | reviewed | 2026-10-06 | Webhooks | timeout number; endpoint disabling (→ R10) |
| R3 | Stripe idempotent requests | applied | 2026-10-06 | API basics 5 (Defend), Webhooks, Resilient APIs | – |
| R4 | AWS timeouts, retries, backoff with jitter | reviewed | 2026-10-06 | Resilient APIs: Timeouts, Retries | closed: formulas added from the AWS simulator source |
| R5 | RFC 6455 WebSocket | reviewed | 2026-10-06 | WebSocket | errata not checked (→ R10) |
| R6 | HTTP semantics: RFC 9110, 9112, 6585 | applied | 2026-10-06 | API basics 3–5, Resilient APIs, Streaming | 409 wording from pre-release XML (→ R10) |
| R7 | JWT: RFC 7519, 8725 | reviewed | 2026-10-06 | Resilient APIs: JWT | HMAC key size (→ R10) |
| R8 | nginx buffering for streaming | reviewed | 2026-10-06 | Streaming / SSE | 1.29.7 default only from a blog (→ R10) |
| R9 | Stripe pagination | reviewed | 2026-10-06 | Resilient APIs: Pages | "why cursors" not on page |
| R10 | Follow-ups from R1–R9 | requested | – | several | – |

The first batch arrived as one export. It's kept unchanged in `findings/raw/2026-10-06-R1-R9-export.md`, and the per-ID files were split from it.

## Rules for the researcher

1. Use only the official page listed, or the page it redirects to on the same site. If a listed URL is dead, find the current official page on the same site and say so.
2. Answer every question. If the page doesn't answer it, write `NOT FOUND ON PAGE`. Don't fill the gap from memory.
3. Write answers in your own words. Short exact quotes (about 25 words at most) are fine only for things that must be exact: header names, string formats, numbers, defaults, code. Put them in backticks.
4. Copy official code samples verbatim when a question asks for one.
5. Record the date you read each page and any "last updated" date shown on it.
6. Write **one file per request**: `findings/R<NN>-<slug>.md` (same slug as the request), using `TEMPLATE.md`. If your tool can only export one file, that's fine: we split it.
7. Blogs, Stack Overflow, AI summaries and other non-official pages never go under `sources`. If you looked at one, mention it under "Could not verify".

## Prompt to give a research agent

> You are a research assistant for the bento-academy repo. Read `research/README.md` (rules) and `research/TEMPLATE.md` (output format). Then answer every request in `research/requests/` whose frontmatter says `status: requested`. For each one, write `research/findings/<same file name>.md`. Follow the rules exactly: official pages only, `NOT FOUND ON PAGE` when the page is silent, and short exact quotes only for values that must be exact. Commit the findings on a branch named `research/<ids>`, for example `research/R10`.

## Our side: reviewing and applying

- **Review:** add a `## Review` section to the finding: verdict (accepted / accepted with gaps / rejected), what to ignore and why, how to teach any gap, and follow-up questions for the next request. Set the request's `status: reviewed`.
- **Apply:** when a lesson uses a finding, add `research = "Rn"` to that source in the lesson's `meta.toml`, add the lesson to the request's `used_by`, and set `status: applied`. The lesson's Read more list then shows "checked in research Rn".
- **Gaps:** never teach a gap as fact. Either leave it out, or label it as our own advice.
