"""Reference answer for Prove: fails on the PR, passes on the fix."""


def test_duplicate_name_is_409(client):
    """A second prompt named 'summarize' is refused with 409"""
    r = client.post("/prompts", json={"name": "summarize", "template": "Again: {text}"})
    assert r.status_code == 409, f"expected 409, got {r.status_code}"
