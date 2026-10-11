"""Lesson 2: a create says 201 Created and where the new thing lives."""

import pytest

NEW = {"name": "rewrite", "template": "Rewrite this politely: {text}"}


@pytest.mark.goal("g1")
@pytest.mark.best_practice
def test_create_returns_201(client):
    """POST /prompts returns 201 Created"""
    r = client.post("/prompts", json=NEW)
    assert r.status_code == 201, f"Expected 201 Created, got {r.status_code}. Add status_code=201 to the decorator."


@pytest.mark.goal("g1")
def test_create_returns_the_prompt(client):
    """The body is the new prompt, with its id"""
    body = client.post("/prompts", json=NEW).json()
    assert body.get("name") == "rewrite" and isinstance(body.get("id"), int), f"Expected the new prompt with an id, got {body!r}"


@pytest.mark.goal("g2")
def test_location_header(client):
    """The response has a Location header pointing at the new prompt"""
    r = client.post("/prompts", json=NEW)
    location = r.headers.get("location")
    assert location, "No Location header. Set response.headers['Location'] = f'/prompts/{id}'."
    assert location == f"/prompts/{r.json()['id']}", f"Location should be /prompts/{r.json()['id']}, got {location!r}"


@pytest.mark.goal("g3")
def test_new_prompt_can_be_fetched(client):
    """The new prompt can be fetched at its address"""
    r = client.post("/prompts", json=NEW)
    address = r.headers.get("location") or f"/prompts/{r.json()['id']}"
    got = client.get(address)
    assert got.status_code == 200 and got.json()["name"] == "rewrite", f"GET {address} should return the new prompt, got {got.status_code} {got.text!r}"
