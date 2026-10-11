"""Reference answer for Prove: fails on the PR, passes on the fix."""


def test_get_never_deletes(client):
    """Opening the delete link with GET doesn't delete the prompt"""
    client.get("/prompts/1/delete")
    assert client.get("/prompts/1").status_code == 200, "prompt 1 was deleted by a GET"
