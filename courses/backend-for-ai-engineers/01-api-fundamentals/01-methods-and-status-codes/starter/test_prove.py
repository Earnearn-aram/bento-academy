"""Prove it: write ONE test that fails on the PR and passes on a correct fix.

The bug to prove: asking for a prompt that doesn't exist returns 200 with `null`.

You get a `client` fixture: a TestClient for the app under test.
Use it like httpx: client.get("/path"), client.post("/path", json={...}).
"""


def test_missing_prompt_is_404(client):
    """A prompt that doesn't exist returns 404"""
    # TODO: request a prompt id that was never created,
    # then assert the status code a correct API returns.
    pass
