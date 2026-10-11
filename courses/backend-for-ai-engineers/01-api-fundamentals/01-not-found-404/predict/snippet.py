"""Predict first, then run."""

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

app = FastAPI()
notes = {1: "hello"}


@app.get("/v1/notes/{note_id}")
def read_note_v1(note_id: int):
    return notes.get(note_id)


@app.get("/v2/notes/{note_id}")
def read_note_v2(note_id: int):
    if note_id not in notes:
        raise HTTPException(status_code=404, detail=f"Note {note_id} not found")
    return notes[note_id]


client = TestClient(app)
r = client.get("/v1/notes/7")
print("Q1  GET /v1/notes/7 ->", r.status_code, r.text)
r = client.get("/v2/notes/7")
print("Q2  GET /v2/notes/7 ->", r.status_code, r.text)
