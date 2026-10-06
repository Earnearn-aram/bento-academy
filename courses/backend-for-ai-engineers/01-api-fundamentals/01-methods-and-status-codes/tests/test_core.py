"""Lesson 1.1: HTTP methods and status codes for a /prompts resource."""

import pytest

PROMPT = {"name": "summarize", "template": "Summarize this text: {text}"}


def create(client, **overrides):
    return client.post("/prompts", json={**PROMPT, **overrides})


def test_create_returns_201(client):
    """POST /prompts returns 201 Created with the new prompt"""
    r = create(client)
    assert r.status_code == 201, (
        f"Expected 201 Created, got {r.status_code}. A POST that creates something should say so."
    )
    body = r.json()
    assert isinstance(body.get("id"), int) and body.get("name") == PROMPT["name"], (
        f"The body should be the new prompt including its id, got {body!r}"
    )


def test_create_sets_location(client):
    """The 201 response has a Location header that points at the new prompt"""
    r = create(client)
    location = r.headers.get("location")
    assert location, "No Location header. A 201 should tell the client where the new resource lives."
    assert location.endswith(f"/prompts/{r.json()['id']}"), f"Location should be /prompts/{{id}}, got {location!r}"
    assert client.get(location).status_code == 200, "Following the Location header should find the prompt."


def test_get_existing(client):
    """GET /prompts/{id} returns 200 with the prompt"""
    created = create(client).json()
    r = client.get(f"/prompts/{created['id']}")
    assert r.status_code == 200, f"Expected 200 OK, got {r.status_code}"
    assert r.json() == created, f"Expected the prompt you created, got {r.json()!r}"


@pytest.mark.best_practice
def test_get_missing_is_404(client):
    """GET for a prompt that doesn't exist returns 404, not 200 with null"""
    r = client.get("/prompts/999")
    assert r.status_code == 404, (
        f"Expected 404 Not Found, got {r.status_code} with body {r.text!r}. "
        "A 200 tells clients and caches that the request succeeded."
    )


def test_list(client):
    """GET /prompts lists every prompt"""
    create(client, name="a")
    create(client, name="b")
    r = client.get("/prompts")
    assert r.status_code == 200, f"Expected 200 OK, got {r.status_code}"
    assert sorted(p["name"] for p in r.json()) == ["a", "b"], f"Expected prompts a and b, got {r.json()!r}"


def test_duplicate_name_is_409(client):
    """Creating a second prompt with the same name returns 409 Conflict"""
    create(client)
    r = create(client, template="Another template")
    assert r.status_code == 409, (
        f"Expected 409 Conflict, got {r.status_code}. The request is valid; it clashes with existing state."
    )
    assert len(client.get("/prompts").json()) == 1, "The duplicate must not be stored."


def test_invalid_body_is_422(client):
    """A body that fails validation returns 422"""
    r = client.post("/prompts", json={"name": "no template"})
    assert r.status_code == 422, f"Expected 422 Unprocessable Content, got {r.status_code}"


@pytest.mark.best_practice
def test_put_is_idempotent(client):
    """Sending the same PUT twice gives the same result as sending it once"""
    pid = create(client).json()["id"]
    new = {"name": "summarize-v2", "template": "Summarize in 3 bullets: {text}"}
    first = client.put(f"/prompts/{pid}", json=new)
    second = client.put(f"/prompts/{pid}", json=new)
    assert first.status_code == 200 and second.status_code == 200, (
        f"Expected 200 for both PUTs, got {first.status_code} and {second.status_code}"
    )
    assert first.json() == second.json() == {"id": pid, **new}, "Both PUTs should leave the same prompt."
    assert len(client.get("/prompts").json()) == 1, "PUT replaced the prompt; it must not create extra ones."


def test_put_missing_is_404(client):
    """PUT on an id that was never created returns 404 (the server assigns ids)"""
    r = client.put("/prompts/42", json=PROMPT)
    assert r.status_code == 404, (
        f"Expected 404, got {r.status_code}. If PUT creates prompt 42, a later POST can be given id 42 too "
        "and overwrite it."
    )


def test_delete_returns_204(client):
    """DELETE /prompts/{id} returns 204 No Content with an empty body, and the prompt is gone"""
    pid = create(client).json()["id"]
    r = client.delete(f"/prompts/{pid}")
    assert r.status_code == 204, f"Expected 204 No Content, got {r.status_code}"
    assert r.content == b"", f"A 204 must have no body, got {r.content!r}"
    assert client.get(f"/prompts/{pid}").status_code == 404, "After DELETE, GET should return 404."


@pytest.mark.best_practice
def test_delete_missing_is_404_not_500(client):
    """DELETE for a prompt that doesn't exist returns 404, never 500"""
    r = client.delete("/prompts/999")
    assert r.status_code == 404, (
        f"Expected 404 Not Found, got {r.status_code}. A 500 means your code crashed (an unhandled KeyError); "
        "a 405 means there is no DELETE route."
    )


@pytest.mark.best_practice
def test_get_never_changes_state(client):
    """GET requests never delete or change anything (GET must be safe)"""
    pid = create(client).json()["id"]
    for path in (f"/prompts/{pid}/delete", f"/prompts/{pid}", "/prompts"):
        client.get(path)
    remaining = [p["id"] for p in client.get("/prompts").json()]
    assert pid in remaining, (
        "The prompt disappeared after GET requests. Browsers, crawlers and link previews send GET freely, "
        "so GET must never delete."
    )
