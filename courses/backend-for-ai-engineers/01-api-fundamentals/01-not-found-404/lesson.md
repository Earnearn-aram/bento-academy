## A response says two things

Every answer from an API carries:

- **the data** (the *body*), and
- **a status code**: a 3-digit number that says *what happened*.

Apps read the number first. If it says "OK", they trust the body.

## The two codes in this lesson

| Code | Means | Use it when |
|---|---|---|
| `200 OK` | It worked, here's the data | the prompt exists |
| `404 Not Found` | There's no such thing | the id doesn't exist |

## The trap: "OK" with nothing inside

`prompts.get(99)` returns `None` when 99 isn't there.

FastAPI turns `None` into `null`, and still sends **`200 OK`**.

So the app hears "it worked" and shows an empty screen.

## Worked example

```python
from fastapi import FastAPI, HTTPException

app = FastAPI()
notes = {1: "hello"}


@app.get("/notes/{note_id}")
def read_note(note_id: int):
    if note_id not in notes:
        raise HTTPException(status_code=404, detail=f"Note {note_id} not found")
    return {"id": note_id, "text": notes[note_id]}
```

`raise HTTPException(...)` stops right there and sends the error code and message to the client.
