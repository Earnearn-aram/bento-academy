Someone pasted a prompt's **delete link** into Slack to ask "should we remove this?".

Slack fetched the link to build a preview, with a **GET** request. The prompt was deleted before anyone answered.

The link was `GET /prompts/7/delete`. That's the bug: a GET that changes things.
