Goal 1: look at all existing prompts. `any(p["name"] == body.name for p in prompts.values())` is `True` when the name is taken.
---
Put the check **before** `prompts[next_id] = prompt`, so a duplicate is never saved (goal 2).
---
```python
if any(p["name"] == body.name for p in prompts.values()):
    raise HTTPException(status_code=409, detail=f"A prompt named {body.name!r} already exists")
```
