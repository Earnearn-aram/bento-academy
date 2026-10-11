## Every request has a method

The **method** says what the client wants to do:

| Method | Means |
|---|---|
| `GET` | read |
| `POST` | create |
| `PUT` | replace |
| `DELETE` | remove |

## GET must be safe

A **safe method** asks for *no change*. `GET` is safe.

Because of that, browsers, search crawlers and chat apps send `GET` requests **on their own**, for previews and pre-loading. If a GET deletes something, they'll delete it.

## Deleting the right way

- Use the **`DELETE`** method.
- On success, return **`204 No Content`**: "done, nothing to send back".
- If the id doesn't exist, return **`404`**. If your code crashes on a missing key, the client gets **`500`**: that's your bug showing.

## Worked example

```python
@app.delete("/notes/{note_id}", status_code=204)
def remove_note(note_id: int):
    if note_id not in notes:
        raise HTTPException(status_code=404, detail="Note not found")
    del notes[note_id]
```

No `return`: a `204` has no body.
