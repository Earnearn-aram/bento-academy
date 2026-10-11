# Fix the bug you found in the review. Follow the goals on the left, then press Run tests.
"""Prompt library API: share prompt templates between our LLM features."""

from fastapi import FastAPI, HTTPException  # TODO: you will also need Response from fastapi
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
    # TODO 2: add a `response: Response` parameter above, then set
    #         response.headers["Location"] = f"/prompts/{prompt['id']}"
    return prompts[prompt_id]

@app.get("/prompts")
def list_prompts():
    return list(prompts.values())


@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: int):
    return get_or_404(prompt_id)

# TODO 1: add status_code=201 to this decorator
@app.post("/prompts")
def create_prompt(body: PromptIn):
    global next_id
    prompt = {"id": next_id, **body.model_dump()}
    prompts[next_id] = prompt
    next_id += 1
    # TODO 2: add a `response: Response` parameter above, then set
    #         response.headers["Location"] = f"/prompts/{prompt['id']}"
    return prompt
