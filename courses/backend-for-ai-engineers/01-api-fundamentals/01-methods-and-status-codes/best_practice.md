Notes marked *(opinion)* are my experience, not documented guidance.

### In production

- **Creates return `201` and a `Location` header**, so the client can fetch the new resource straight away (MDN: 201, Location). FastAPI won't do this for you; its default is `200`.
- **Put the success code on the decorator** (`status_code=201`). FastAPI then also writes it into the OpenAPI docs, and it marks 204 routes as having no body.
- **Use the named constants** (`status.HTTP_409_CONFLICT`). They exist for editor autocomplete, and they read better in review than bare numbers *(opinion)*.
- **What this exercise leaves out: a real database.** "Name must be unique" belongs in a database unique constraint, with the violation mapped to `409`. A Python check-then-insert lets two concurrent requests both pass the check *(standard database practice; database docs aren't part of this lesson)*.
- Real APIs also return **one consistent error body** for every 4xx and 5xx. That's lesson 1.5.

### Common mistakes

**1. "Not found" as a successful empty answer**

```python
# ✗ 200 with null: clients and caches see success
@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: int):
    return prompts.get(prompt_id)

# ✓
@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: int):
    if prompt_id not in prompts:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prompt not found")
    return prompts[prompt_id]
```

**2. Letting bad input crash the server**

```python
# ✗ unknown id → KeyError → 500 (your bug, visible to everyone)
del prompts[prompt_id]

# ✓ unknown id → 404 (their mistake, clearly explained)
get_or_404(prompt_id)
del prompts[prompt_id]
```

**3. Changing state in a GET**

```python
# ✗ prefetchers, crawlers and link previews will call this
@app.get("/prompts/{prompt_id}/delete")

# ✓
@app.delete("/prompts/{prompt_id}", status_code=204)
```

### Trade-offs

- **PUT or PATCH:** PUT replaces the whole resource and is idempotent. PATCH applies a partial change and is *not* idempotent by definition (MDN method table). Use PUT when clients send the full object. With PATCH, think through what a retry does.
- **Second DELETE, `404` or `204`:** both keep DELETE idempotent, because idempotency is about state, not the response (MDN). `404` surfaces client bugs; `204` keeps automatic retries quiet. Pick one and document it *(opinion)*.
- **DELETE response, `204` or `200` with a body:** MDN lists both as valid. Use `204` unless the client needs something back.
- **`409` or `422`:** `422` means the content itself is invalid, so resending it unchanged fails again (MDN 422). `409` means a valid request clashes with current state and may succeed later (MDN 409).

### What breaks at scale

- **In-memory state is per process.** With `uvicorn --workers 4`, each worker has its own `prompts` dict and its own `next_id`. A POST handled by worker 1 is a 404 on worker 2, and two workers hand out the same id. State has to live in a shared store.
- **Check-then-insert races.** Across workers or instances, two requests can both see "name is free" and both insert. Only the database's unique constraint is atomic.
- **Retries:** clients and proxies may resend idempotent requests automatically (MDN: an idempotent request can be retried safely). A retried POST creates a duplicate. Idempotency keys fix that; see Module 5.

### Security and reliability

- **GET must be safe.** MDN names browser prefetching and crawlers as callers that rely on it. Chat-app link previews do the same *(my addition)*.
- **Any 5xx a client can trigger with bad input is a bug.** It also tells an attacker which inputs crash you. Validate, and return a 4xx.

### Observability

- **Count responses by route template and status class**, for example `DELETE /prompts/{prompt_id}` → 4xx. Use the route template, not the raw URL with the id in it, so metrics don't explode into one series per id *(common practice)*.
- **Read 4xx and 5xx differently.** A rising 4xx rate usually means a client bug or a breaking API change. A rising 5xx rate is your bug: alert on it *(opinion)*.
