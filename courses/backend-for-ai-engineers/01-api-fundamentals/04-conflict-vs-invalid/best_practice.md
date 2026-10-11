*Optional reading. Notes marked (opinion) are experience, not documented rules.*

### 409 or 422?
MDN: with `422`, sending the same request again will fail again (the content is wrong). With `409`, the request is valid but conflicts with the current state, so it may work later.

### What breaks at scale
"Check, then save" has a gap: two requests at the same moment can both see "name is free" and both save. With a real database, a **unique constraint** closes the gap, and you turn its error into `409` *(standard database practice)*.

### Client experience
Separate codes let the app react without parsing messages: show field errors on `422`, "choose another name" on `409` *(opinion)*.
