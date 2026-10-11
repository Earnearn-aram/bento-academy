Goal 1: the success code goes on the decorator: `@app.post("/prompts", status_code=201)`.
---
Goal 2: add a parameter `response: Response` to the function (import `Response` from `fastapi`). FastAPI fills it in for you.
---
```python
response.headers["Location"] = f"/prompts/{prompt['id']}"
return prompt
```
