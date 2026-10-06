## The story

You built a great summarizer in a notebook. Paste a document, it calls Claude, and three bullet points come back. The demo goes well.

Then the requests arrive:

- The **mobile team** wants it in their app.
- The **Slack bot** wants to call it whenever someone pastes a link.
- A **partner company** wants to call it from their own servers and pay per request.

None of them can import your notebook. They use different languages, run on different machines and ship on different days. What they need is a **contract**: *"send me this over HTTP, I'll send you back that, and when something goes wrong I'll tell you exactly what."* That contract is an **API**.

## What changes when other people depend on your code

| In a notebook | Behind an API |
|---|---|
| **You** read the error and rerun the cell | A **program** reads a status code and decides what to do |
| One user: you | Many clients at once, some on slow phones |
| The model takes 8 seconds; you wait | Clients give up, retry, and may send the same request twice |
| Anyone with the file can run it | You must know who is calling, and stop the ones who shouldn't |

## Why this matters for an AI engineer

LLM features fail in API-shaped ways. Anthropic's API, for example, answers `429` when you hit a rate limit, `504` when a request times out and `529` when it is overloaded. Its official SDK retries these with exponential backoff. Calls are slow and cost money, so a careless retry doubles the bill. Prompts and keys are sensitive.

Senior interviews probe exactly this: *"What does your endpoint return when the model times out? What happens if the client retries? How do you know who called?"*

## What you'll build

A small **LLM gateway**: one service your teams call instead of calling model providers directly. Each lesson adds one piece:

1. **Methods & status codes:** its prompt library says exactly what happened.
2. **Pydantic models:** bad input is rejected at the door, and secrets never leak into responses.
3. **Async vs sync:** one slow model call doesn't freeze everyone else.
4. **Timeouts & retries:** survive a flaky upstream without making it worse.
5. **Error handling:** one consistent error shape; upstream failures become `502` / `504`.
6. **Pagination:** long lists come back in pages that never skip or repeat.
7. **Auth: API key & JWT:** know who is calling.

*Lessons 2–7 are being written; lesson 1 is ready now.*

> Sources: the status codes above are from Anthropic's [API errors](https://docs.claude.com/en/api/errors) page.
