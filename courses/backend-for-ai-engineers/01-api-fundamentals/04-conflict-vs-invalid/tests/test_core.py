"""Lesson 4: a duplicate name is a clash (409); a broken body is 422."""

import pytest

DUPLICATE = {"name": "summarize", "template": "Another summarizer: {text}"}


@pytest.mark.goal("g1")
@pytest.mark.best_practice
def test_duplicate_name_is_409(client):
    """Creating a second 'summarize' prompt returns 409 Conflict"""
    r = client.post("/prompts", json=DUPLICATE)
    assert r.status_code == 409, (
        f"Expected 409 Conflict, got {r.status_code}. The request is fine; it clashes with a prompt that exists."
    )


@pytest.mark.goal("g2")
def test_duplicate_not_saved(client):
    """The duplicate isn't saved"""
    client.post("/prompts", json=DUPLICATE)
    names = [p["name"] for p in client.get("/prompts").json()]
    assert names.count("summarize") == 1, f"Expected one 'summarize' prompt, got {names!r}"


@pytest.mark.goal("g3")
def test_missing_field_is_422(client):
    """A body with a missing field gets 422 (FastAPI does this for you)"""
    r = client.post("/prompts", json={"name": "only-a-name"})
    assert r.status_code == 422, f"Expected 422, got {r.status_code}"


@pytest.mark.goal("g3")
def test_new_name_still_works(client):
    """A new, unique name still gets 201"""
    r = client.post("/prompts", json={"name": "rewrite", "template": "Rewrite: {text}"})
    assert r.status_code == 201, f"Expected 201, got {r.status_code}"
