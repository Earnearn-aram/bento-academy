## Two kinds of "no"

When a create can't happen, *why* matters to the client:

| Code | Means | Example |
|---|---|---|
| `422` | the **request itself** is broken | the `template` field is missing |
| `409` | the request is fine, but it **clashes** with what exists | the name is taken |

## 422: FastAPI does it for you

`PromptIn` is a **Pydantic model**: it describes what a valid body looks like.

If a field is missing or has the wrong type, FastAPI rejects the request with `422` before your code even runs.

## 409: you decide

FastAPI can't know your rules ("names must be unique"). You check, and raise:

```python
raise HTTPException(status_code=409, detail="...")
```

Check **before** saving, so nothing half-done is left behind.

## Worked example

```python
@app.post("/tags", status_code=201)
def add_tag(name: str):
    if name in tags:
        raise HTTPException(status_code=409, detail=f"Tag {name!r} already exists")
    tags.add(name)
    return {"name": name}
```
