"""Lesson 3: deleting uses DELETE; GET never changes anything."""

import pytest


@pytest.mark.goal("g1")
def test_delete_returns_204(client):
    """DELETE /prompts/1 returns 204 No Content with an empty body"""
    r = client.delete("/prompts/1")
    assert r.status_code == 204, f"Expected 204 No Content, got {r.status_code}. (405 means there's no DELETE route yet.)"
    assert r.content == b"", f"A 204 must have no body, got {r.content!r}"


@pytest.mark.goal("g1")
def test_deleted_prompt_is_gone(client):
    """After DELETE, GET /prompts/1 returns 404"""
    client.delete("/prompts/1")
    assert client.get("/prompts/1").status_code == 404, "Prompt 1 is still there after DELETE."


@pytest.mark.goal("g2")
@pytest.mark.best_practice
def test_delete_missing_is_404(client):
    """DELETE on an id that doesn't exist returns 404, never 500"""
    r = client.delete("/prompts/99")
    assert r.status_code == 404, (
        f"Expected 404, got {r.status_code}. 500 means the code crashed (KeyError); 405 means there's no DELETE route."
    )


@pytest.mark.goal("g3")
@pytest.mark.best_practice
def test_get_never_deletes(client):
    """GET requests never delete anything"""
    for path in ("/prompts/1/delete", "/prompts/1", "/prompts"):
        client.get(path)
    ids = [p["id"] for p in client.get("/prompts").json()]
    assert 1 in ids, "Prompt 1 disappeared after GET requests. Link previews and crawlers send GET freely, so GET must never delete."
