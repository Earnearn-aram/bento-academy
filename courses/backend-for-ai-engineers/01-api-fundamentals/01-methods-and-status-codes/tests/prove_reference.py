"""Reference answer for the Prove step: one test that fails on the PR and passes on the fix."""


def test_missing_prompt_is_404(client):
    """A prompt that doesn't exist returns 404"""
    r = client.get("/prompts/12345")
    assert r.status_code == 404, f"expected 404 for a missing prompt, got {r.status_code} {r.text!r}"
