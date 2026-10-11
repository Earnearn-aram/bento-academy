Start with goal 2. What does `prompts.get(99)` return? You need to *check first* and stop early when the id isn't there.
---
To stop a request with an error code, `raise HTTPException(status_code=404, detail="...")`. Import `HTTPException` from `fastapi` at the top.
---
```python
if prompt_id not in prompts:
    raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
return prompts[prompt_id]
```
