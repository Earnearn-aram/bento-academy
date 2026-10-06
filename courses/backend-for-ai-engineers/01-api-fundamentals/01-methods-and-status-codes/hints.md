Look at what `prompts.get(prompt_id)` returns for an unknown id, and what FastAPI does when a route returns `None`. Which exception stops a request and sends a status code?
---
The decorator takes `status_code=...`. To add a header, accept a `response: Response` parameter and set `response.headers["Location"]`. For DELETE, use `status_code=204` and return nothing.
---
Write one helper, `get_or_404(prompt_id)`, that raises `HTTPException(404)`, and use it in GET, PUT and DELETE. Change `@app.get("/prompts/{prompt_id}/delete")` to `@app.delete("/prompts/{prompt_id}")`. Before creating, check whether a stored prompt already has that name and raise `HTTPException(409)`.
