"""Bonus: write ONE test that fails on the PR and passes on your fix.

The bug: asking for a prompt that doesn't exist returns 200 with `null`.

`client` is a test client for the app. Use it like this:
    r = client.get("/prompts/1")
    r.status_code   # e.g. 200
    r.json()        # the body
"""


def test_missing_prompt_is_404(client):
    """A prompt that doesn't exist returns 404"""
    # TODO: ask for a prompt id that doesn't exist (e.g. 12345),
    # then assert that r.status_code is 404.
    pass
