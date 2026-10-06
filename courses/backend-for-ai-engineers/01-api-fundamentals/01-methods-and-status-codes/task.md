A teammate's PR adds a **prompt library** API. You reviewed it; now fix `main.py` so every route says exactly what happened:

- `POST /prompts` → `201` with a `Location: /prompts/{id}` header. A name that already exists → `409`.
- `GET /prompts/{id}` → `200`, or `404` if it doesn't exist.
- `GET /prompts` → `200` with the list.
- `PUT /prompts/{id}` → replaces it, `200`. Unknown id → `404` (the server assigns ids, so PUT never creates).
- `DELETE /prompts/{id}` → `204` with no body. Unknown id → `404`.
- No `GET` route may change anything.

Keep the `PromptIn` model as it is. Pydantic gets its own lesson next.
