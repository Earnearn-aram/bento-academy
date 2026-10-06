"""Predict first, then run. What status does each request get?"""

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

app = FastAPI()
notes = {1: "hello"}


@app.post("/notes")
def add_note(text: str):
    note_id = max(notes, default=0) + 1
    notes[note_id] = text
    return {"id": note_id}


@app.get("/notes/{note_id}")
def read_note(note_id: int):
    return notes.get(note_id)


@app.delete("/notes/{note_id}")
def remove_note(note_id: int):
    if note_id not in notes:
        raise HTTPException(status_code=404, detail="Note not found")
    del notes[note_id]
    return {"deleted": note_id}


client = TestClient(app)
r = client.post("/notes", params={"text": "hi"})
print("Q1  POST /notes            ->", r.status_code, r.text)
r = client.get("/notes/7")
print("Q2  GET  /notes/7          ->", r.status_code, r.text)
print("Q3  DELETE /notes/1 (1st)  ->", client.delete("/notes/1").status_code)
print("    DELETE /notes/1 (2nd)  ->", client.delete("/notes/1").status_code)
