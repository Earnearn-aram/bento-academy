## Say exactly what happened

A response has two jobs: carry data, and tell the client **what happened**. The method says what the client *intends*. The status code says what the server *did*. Browsers, caches, retry logic and dashboards act on those numbers without reading your body.

**Methods come with promises** (from MDN's method table):

| Method | Safe | Idempotent | Typical use |
|---|---|---|---|
| GET | yes | yes | read |
| POST | no | no | create, or "run this action" |
| PUT | no | yes | replace the whole resource |
| DELETE | no | yes | remove |

*Safe* means the client asks for no change, so browsers can prefetch and crawlers can follow links. *Idempotent* means sending the same request twice has the same intended effect as sending it once, so a client can retry when it isn't sure the first one arrived. The response may differ (a second DELETE can return 404); the server state must not.

**The codes you'll use most:**

- `200 OK`: it worked, here is the body.
- `201 Created`: something new exists. Add a `Location` header with its URL.
- `204 No Content`: it worked, and there is no body (common for DELETE).
- `404 Not Found`: no such resource. Never `200` with `null`.
- `409 Conflict`: the request is valid but clashes with current state, like a duplicate name.
- `422 Unprocessable Content`: the body parsed but failed validation. FastAPI sends this for you when a Pydantic model rejects input.
- `5xx`: your server failed. If a client can cause a 500, that's your bug.

**FastAPI returns 200 for every route by default.** It does not pick 201 because a route is a POST. You set `status_code=` on the decorator, raise `HTTPException` for errors, and add headers through a `Response` parameter.

## Worked example

```python
import itertools

from fastapi import FastAPI, HTTPException, Response, status

app = FastAPI()
notes: dict[int, str] = {}
ids = itertools.count(1)


@app.post("/notes", status_code=status.HTTP_201_CREATED)
def add_note(text: str, response: Response):
    note_id = next(ids)
    notes[note_id] = text
    response.headers["Location"] = f"/notes/{note_id}"
    return {"id": note_id, "text": text}


@app.get("/notes/{note_id}")
def read_note(note_id: int):
    if note_id not in notes:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    return {"id": note_id, "text": notes[note_id]}
```

`raise` (not `return`) stops the request right there and sends the error, even from inside a helper function.
