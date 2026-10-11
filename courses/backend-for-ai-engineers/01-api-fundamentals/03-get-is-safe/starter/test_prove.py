"""Bonus: write ONE test that fails on the PR and passes on your fix.

The bug: a GET request (like a link preview) deletes a prompt.
"""


def test_get_never_deletes(client):
    """Opening the delete link with GET doesn't delete the prompt"""
    # TODO: client.get("/prompts/1/delete"), then check prompt 1 still exists:
    # assert client.get("/prompts/1").status_code == 200
    pass
