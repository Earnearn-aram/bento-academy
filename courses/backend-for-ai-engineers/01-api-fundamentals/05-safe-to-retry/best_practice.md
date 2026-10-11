*Optional reading. Notes marked (opinion) are experience, not documented rules.*

### Why idempotency matters
MDN: a client can safely retry an idempotent request when it isn't sure the first one arrived. `POST` is not idempotent, so a retried create can make duplicates. Module 5 (webhooks) shows **idempotency keys**, the standard fix.

### PUT or PATCH?
`PUT` replaces the whole thing and is idempotent. `PATCH` changes part of it and is not idempotent by definition (MDN method table).

### Left out here
Renaming a prompt with `PUT` to a name that's already taken should also be `409` (like lesson 4).
