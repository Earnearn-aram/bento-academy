*Optional reading. Notes marked (opinion) are experience, not documented rules.*

### In production
- Return `201` **and** `Location` from every create endpoint, so clients never guess addresses (MDN: 201, Location).
- Putting `status_code=201` on the decorator also puts it in the auto-generated API docs (FastAPI: Response Status Code).

### Common mistake
```python
# ✗ "OK", and no address
@app.post("/prompts")

# ✓ "Created", plus where it lives
@app.post("/prompts", status_code=201)
...
response.headers["Location"] = f"/prompts/{prompt['id']}"
```

### What breaks at scale
`next_id` lives in one Python process. Run 4 server processes and each has its own counter, so two prompts get the same id. A database assigns ids safely *(common practice)*.
