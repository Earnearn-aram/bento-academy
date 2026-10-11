Goal 1: change the decorator to `@app.delete("/prompts/{prompt_id}", status_code=204)` and remove the `return` line.
---
Goal 2: before `del`, call `get_or_404(prompt_id)`. It raises the 404 for you when the id is missing.
---
Goal 3 is fixed by goal 1: once the route uses DELETE, a GET to `/prompts/1/delete` just finds nothing (404) and deletes nothing.
