# Fix the bug you found in the review. Follow the goals on the left, then press Run tests.
"""Prompt library API: share prompt templates between our LLM features."""

from fastapi import FastAPI  # TODO: you will also need HTTPException from fastapi

app = FastAPI()

# A few prompts to start with. A real service would use a database.
prompts = {
    1: {"id": 1, "name": "summarize", "template": "Summarize this text: {text}"},
    2: {"id": 2, "name": "translate", "template": "Translate to French: {text}"},
}


@app.get("/prompts")
def list_prompts():
    return list(prompts.values())


@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: int):
    # TODO 1: if prompt_id is not in prompts, raise HTTPException(status_code=404, ...)
    # TODO 2: give it a helpful message, e.g. detail=f"Prompt {prompt_id} not found"
    return prompts.get(prompt_id)
