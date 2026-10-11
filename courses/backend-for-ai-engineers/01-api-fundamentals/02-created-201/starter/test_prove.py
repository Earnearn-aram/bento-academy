"""Bonus: write ONE test that fails on the PR and passes on your fix.

The bug: creating a prompt returns 200 instead of 201.
"""


def test_create_returns_201(client):
    """Creating a prompt returns 201"""
    # TODO: r = client.post("/prompts", json={"name": "...", "template": "..."})
    # then assert r.status_code == 201
    pass
