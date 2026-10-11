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

LLM features fail in API-shaped ways. When you call Anthropic's API too fast, it answers `429` ("slow down"). When a request takes too long, it answers `504`. Its official SDK knows these codes and tries again later on its own. That only works because the API says clearly what went wrong.

Model calls are also slow and cost money, so sending the same request twice by accident costs twice as much.

Senior interviews ask exactly this: *"What does your endpoint return when the model times out? What happens if the client tries again?"*

## What you'll build

A small **prompt library API**: one place where your teams store and share prompt templates. Each lesson is one small box, about 10–15 minutes:

1. **Not found means 404:** asking for a prompt that doesn't exist says "not found", not "OK".
2. **Created means 201:** adding a prompt says "created" and where to find it.
3. **GET never changes anything:** reading is always harmless; deleting uses `DELETE`.
4. **Clash or bad input?** A duplicate name is a `409` clash, not a `422` broken request.
5. **Safe to retry:** sending the same request twice does no extra harm.

*Coming next, in the same small steps: rejecting bad input with Pydantic, not leaking secrets, then a module on resilient APIs (slow calls, timeouts, retries, errors, pages and auth).*

> Sources: the status codes above are from Anthropic's [API errors](https://docs.claude.com/en/api/errors) page.
