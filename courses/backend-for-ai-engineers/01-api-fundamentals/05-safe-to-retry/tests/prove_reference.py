"""Reference answer for Prove: fails on the PR, passes on the fix."""


def test_put_unknown_is_404(client):
    """PUT on an unknown id returns 404"""
    r = client.put("/prompts/42", json={"name": "x", "template": "y"})
    assert r.status_code == 404, f"expected 404, got {r.status_code}"
