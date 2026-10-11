*Optional reading. Notes marked (opinion) are experience, not documented rules.*

### Why it matters
MDN: safe methods let browsers pre-fetch and crawlers follow links without harm. Chat apps building link previews do the same *(my addition)*.

### Common mistakes
```python
# ✗ a link that deletes
@app.get("/prompts/{prompt_id}/delete")

# ✗ unknown id → KeyError → 500
del prompts[prompt_id]

# ✓
@app.delete("/prompts/{prompt_id}", status_code=204)
def delete_prompt(prompt_id: int):
    get_or_404(prompt_id)
    del prompts[prompt_id]
```

### Security
With cookie-based login, a page on another site can make the user's browser send a GET (for example from an `<img>` tag). A GET that deletes turns that into an attack (CSRF) *(general security practice, not from this lesson's sources)*.

### Trade-off
`DELETE` may return `204` (nothing to say) or `200` with a body (MDN lists both). Use `204` unless the client needs something back.
