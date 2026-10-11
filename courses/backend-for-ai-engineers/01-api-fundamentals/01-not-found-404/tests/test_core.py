"""Lesson 1: a missing prompt must say 404 Not Found."""

import pytest


@pytest.mark.goal("g1")
def test_existing_prompt(client):
    """GET /prompts/1 returns 200 with the prompt"""
    r = client.get("/prompts/1")
    assert r.status_code == 200, f"Expected 200 OK, got {r.status_code}"
    assert r.json()["name"] == "summarize", f"Expected the 'summarize' prompt, got {r.json()!r}"


@pytest.mark.goal("g1")
def test_list(client):
    """GET /prompts lists both prompts"""
    r = client.get("/prompts")
    assert r.status_code == 200, f"Expected 200 OK, got {r.status_code}"
    assert len(r.json()) == 2, f"Expected 2 prompts, got {r.json()!r}"


@pytest.mark.goal("g2")
@pytest.mark.best_practice
def test_missing_is_404(client):
    """GET /prompts/99 (it doesn't exist) returns 404, not 200 with null"""
    r = client.get("/prompts/99")
    assert r.status_code == 404, (
        f"Expected 404 Not Found, got {r.status_code} with body {r.text!r}. "
        "A 200 tells the app 'it worked', so it shows an empty prompt."
    )


@pytest.mark.goal("g3")
def test_missing_has_detail(client):
    """The 404 says which prompt is missing"""
    r = client.get("/prompts/99")
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else None
    detail = body.get("detail") if isinstance(body, dict) else None
    assert detail and "99" in str(detail), (
        f"Expected a body like {{'detail': 'Prompt 99 not found'}}, got {r.text!r}"
    )
