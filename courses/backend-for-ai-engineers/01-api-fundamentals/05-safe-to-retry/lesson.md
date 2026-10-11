## Retries happen

Networks drop replies. When a client doesn't hear back, it often **sends the same request again**.

So ask of every endpoint: *what if this arrives twice?*

## Idempotent

**Idempotent** means: sending it twice has the same effect as sending it once.

| Method | Idempotent? | Twice means… |
|---|---|---|
| `GET` | yes | read twice, nothing changes |
| `PUT` | yes | replace with the same thing twice: same result |
| `DELETE` | yes | gone after the first; still gone after the second |
| `POST` | **no** | create twice → **two** items |

## The answer may differ, the state may not

A second `DELETE` can answer `404` (it's already gone). That's fine: what matters is the data on the server is the same.

## PUT should only replace

Here the **server** picks ids. If `PUT /prompts/42` *creates* prompt 42, it can later clash with the id `POST` hands out. So: unknown id → `404`.

```python
@app.put("/prompts/{prompt_id}")
def replace_prompt(prompt_id: int, body: PromptIn):
    get_or_404(prompt_id)
    prompts[prompt_id] = {"id": prompt_id, **body.model_dump()}
    return prompts[prompt_id]
```
