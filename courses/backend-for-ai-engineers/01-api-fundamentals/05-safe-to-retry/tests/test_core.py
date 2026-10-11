"""Lesson 5: PUT replaces existing prompts only; repeating it changes nothing."""

import pytest

NEW = {"name": "summarize-v2", "template": "Summarize in 3 bullets: {text}"}


@pytest.mark.goal("g1")
def test_put_replaces(client):
    """PUT /prompts/1 replaces prompt 1 and returns 200 with it"""
    r = client.put("/prompts/1", json=NEW)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    assert r.json() == {"id": 1, **NEW}, f"Expected the replaced prompt, got {r.json()!r}"
    assert client.get("/prompts/1").json() == {"id": 1, **NEW}, "GET /prompts/1 should show the new version"


@pytest.mark.goal("g2")
@pytest.mark.best_practice
def test_put_twice_same_result(client):
    """Sending the same PUT twice gives the same result as sending it once"""
    first = client.put("/prompts/1", json=NEW)
    second = client.put("/prompts/1", json=NEW)
    assert first.json() == second.json(), "Both PUTs should return the same prompt"
    assert len(client.get("/prompts").json()) == 2, "PUT must replace, not add prompts"


@pytest.mark.goal("g3")
@pytest.mark.best_practice
def test_put_unknown_is_404(client):
    """PUT on an id that doesn't exist returns 404 and creates nothing"""
    r = client.put("/prompts/42", json=NEW)
    assert r.status_code == 404, f"Expected 404, got {r.status_code}. If PUT creates prompt 42, POST can hand out 42 later and overwrite it."
    assert all(p["id"] != 42 for p in client.get("/prompts").json()), "PUT created prompt 42"
