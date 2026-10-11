"""Reference answer for Prove: fails on the PR, passes on the fix."""


def test_create_returns_201(client):
    """Creating a prompt returns 201"""
    r = client.post("/prompts", json={"name": "rewrite", "template": "Rewrite: {text}"})
    assert r.status_code == 201, f"expected 201, got {r.status_code}"
