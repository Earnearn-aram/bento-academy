"""Predict first, then run."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()
items = {}


@app.post("/items")
def create(name: str):
    items[len(items) + 1] = name
    return {"count": len(items)}


@app.put("/items/{item_id}")
def replace(item_id: int, name: str):
    items[item_id] = name
    return {"count": len(items)}


client = TestClient(app)
client.post("/items", params={"name": "a"})
print("Q1  after POST twice ->", client.post("/items", params={"name": "a"}).json())
items.clear()
client.put("/items/1", params={"name": "a"})
print("Q2  after PUT twice  ->", client.put("/items/1", params={"name": "a"}).json())
