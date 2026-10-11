*Optional reading. Notes marked (opinion) are experience, not documented rules.*

### In production
- Use **one error shape** for every error (FastAPI's default is `{"detail": ...}`). Clients can then show messages without special cases.
- With a real database, the check is the query itself: "no row found" → `404`.
- For private data, some teams return `404` instead of `403` so outsiders can't even learn that something exists *(opinion)*.

### Common mistake
```python
# ✗ 200 with null
return prompts.get(prompt_id)

# ✓ 404 with a reason
if prompt_id not in prompts:
    raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
return prompts[prompt_id]
```

### Observability
Count responses by **route template** (`/prompts/{prompt_id}`) and status. A jump in 404s often means a client is using old ids *(common practice)*.
