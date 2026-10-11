"""Bonus: write ONE test that fails on the PR and passes on your fix.

The bug: PUT on an id that doesn't exist creates it.
"""


def test_put_unknown_is_404(client):
    """PUT on an unknown id returns 404"""
    # TODO: r = client.put("/prompts/42", json={"name": "...", "template": "..."})
    # then assert r.status_code == 404
    pass
