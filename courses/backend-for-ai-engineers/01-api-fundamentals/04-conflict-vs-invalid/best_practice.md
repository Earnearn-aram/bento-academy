*Optional reading. Notes marked (opinion) are experience, not documented rules.*

### 409 or 422?
MDN: with `422`, sending the same request again will fail again (the content is wrong). With `409`, the request is valid but conflicts with the current state, so it may work later.

### What the standard says
RFC 9110, the HTTP standard: a `409` means the request clashes with the current state, and the client may be able to fix it and resend. So the response should say *what* clashed. Our `detail` names the duplicate for exactly that reason. The standard's name for `422` is **Unprocessable Content** (it used to be "Unprocessable Entity", which FastAPI's docs still use).

### What breaks at scale
"Check, then save" has a gap: two requests at the same moment can both see "name is free" and both save. With a real database, a **unique constraint** closes the gap, and you turn its error into `409` *(standard database practice)*.

### Client experience
Separate codes let the app react without parsing messages: show field errors on `422`, "choose another name" on `409` *(opinion)*.
