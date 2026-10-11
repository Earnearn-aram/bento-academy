"""Predict first, then run."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

app = FastAPI()
tags = []


class TagIn(BaseModel):
    name: str


@app.post("/tags", status_code=201)
def add_tag(body: TagIn):
    tags.append(body.name)
    return {"name": body.name}


client = TestClient(app)
print("Q1  missing name ->", client.post("/tags", json={}).status_code)
client.post("/tags", json={"name": "ai"})
r = client.post("/tags", json={"name": "ai"})
print("Q2  second 'ai'  ->", r.status_code, "| tags now:", tags)
