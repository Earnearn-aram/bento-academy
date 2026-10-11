## Read vs create

- `GET` = **read** something. Success is `200 OK`.
- `POST` = **create** something new. Success should be **`201 Created`**.

`201` tells the client: *"a new thing exists now."*

## Say where it lives

A `201` should come with a **`Location` header**: the address of the new thing.

```http
HTTP/1.1 201 Created
Location: /prompts/3
```

The client can go straight to `/prompts/3`. No guessing.

## FastAPI doesn't do this for you

FastAPI sends **`200` for every route** unless you change it. It doesn't pick `201` because a route is a POST.

You set it yourself:

- `status_code=201` on the decorator,
- a `response: Response` parameter to add headers.

## Worked example

```python
from fastapi import FastAPI, Response

app = FastAPI()
notes = {}


@app.post("/notes", status_code=201)
def add_note(text: str, response: Response):
    note_id = len(notes) + 1
    notes[note_id] = text
    response.headers["Location"] = f"/notes/{note_id}"
    return {"id": note_id, "text": text}
```
