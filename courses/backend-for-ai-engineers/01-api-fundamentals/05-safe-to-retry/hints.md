Goals 1 and 2 already pass: run the tests first and see which goal is red.
---
Goal 3: before replacing, call `get_or_404(prompt_id)`. It raises `404` when the id isn't there, so nothing gets created.
---
```python
get_or_404(prompt_id)  # the server picks ids, so PUT only replaces
prompts[prompt_id] = {"id": prompt_id, **body.model_dump()}
return prompts[prompt_id]
```
