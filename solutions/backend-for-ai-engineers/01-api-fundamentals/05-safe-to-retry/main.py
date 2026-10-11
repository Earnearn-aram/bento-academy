"""Prompt library API: share prompt templates between our LLM features."""

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel

app = FastAPI()

class PromptIn(BaseModel):
    name: str
    template: str

# A few prompts to start with. A real service would use a database.
prompts = {
    1: {"id": 1, "name": "summarize", "template": "Summarize this text: {text}"},
    2: {"id": 2, "name": "translate", "template": "Translate to French: {text}"},
}
next_id = 3

def get_or_404(prompt_id: int) -> dict:
    if prompt_id not in prompts:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
    return prompts[prompt_id]

@app.get("/prompts")
def list_prompts():
    return list(prompts.values())


@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: int):
    return get_or_404(prompt_id)

@app.post("/prompts", status_code=201)
def create_prompt(body: PromptIn, response: Response):
    global next_id
    if any(p["name"] == body.name for p in prompts.values()):
        raise HTTPException(status_code=409, detail=f"A prompt named {body.name!r} already exists")
    prompt = {"id": next_id, **body.model_dump()}
    prompts[next_id] = prompt
    next_id += 1
    response.headers["Location"] = f"/prompts/{prompt['id']}"
    return prompt

@app.delete("/prompts/{prompt_id}", status_code=204)
def delete_prompt(prompt_id: int):
    get_or_404(prompt_id)
    del prompts[prompt_id]

@app.put("/prompts/{prompt_id}")
def replace_prompt(prompt_id: int, body: PromptIn):
    get_or_404(prompt_id)  # the server picks ids, so PUT only replaces
    prompts[prompt_id] = {"id": prompt_id, **body.model_dump()}
    return prompts[prompt_id]
