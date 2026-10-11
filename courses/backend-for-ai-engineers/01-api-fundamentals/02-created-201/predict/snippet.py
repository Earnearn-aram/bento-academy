"""Predict first, then run."""

from fastapi import FastAPI, Response
from fastapi.testclient import TestClient

app = FastAPI()
notes = {}


@app.post("/v1/notes")
def add_v1(text: str):
    notes[len(notes) + 1] = text
    return {"id": len(notes)}


@app.post("/v2/notes", status_code=201)
def add_v2(text: str, response: Response):
    notes[len(notes) + 1] = text
    return {"id": len(notes)}


client = TestClient(app)
r = client.post("/v1/notes", params={"text": "hi"})
print("Q1  POST /v1/notes ->", r.status_code)
r = client.post("/v2/notes", params={"text": "hi"})
print("Q2  POST /v2/notes ->", r.status_code, "| Location:", r.headers.get("location"))
