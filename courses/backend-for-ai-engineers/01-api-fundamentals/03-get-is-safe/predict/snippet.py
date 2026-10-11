"""Predict first, then run."""

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

app = FastAPI()
notes = {1: "hello"}


@app.delete("/v1/notes/{note_id}", status_code=204)
def remove_v1(note_id: int):
    del notes[note_id]


@app.delete("/v2/notes/{note_id}", status_code=204)
def remove_v2(note_id: int):
    if note_id not in notes:
        raise HTTPException(status_code=404, detail="Note not found")
    del notes[note_id]


client = TestClient(app, raise_server_exceptions=False)
print("Q1  DELETE /v1/notes/9 ->", client.delete("/v1/notes/9").status_code)
r = client.delete("/v2/notes/9")
print("Q2  DELETE /v2/notes/9 ->", r.status_code, r.text)
