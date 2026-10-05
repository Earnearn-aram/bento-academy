"""Prompt library API: store reusable prompt templates for our LLM features."""

import json

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class PromptIn(BaseModel):
    name: str
    template: str


prompts: dict[int, dict] = {}
next_id = 1


@app.get("/prompts")
def list_prompts():
    return list(prompts.values())


@app.post("/prompts")
def create_prompt(body: PromptIn):
    global next_id
    prompt = {"id": next_id, **body.model_dump()}
    prompts[next_id] = prompt
    next_id += 1
    return prompt


@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: int):
    return prompts.get(prompt_id)


@app.put("/prompts/{prompt_id}")
def replace_prompt(prompt_id: int, body: PromptIn):
    prompts[prompt_id] = {"id": prompt_id, **body.model_dump()}
    return prompts[prompt_id]


@app.get("/prompts/{prompt_id}/delete")
def delete_prompt(prompt_id: int):
    del prompts[prompt_id]
    return {"deleted": True}
