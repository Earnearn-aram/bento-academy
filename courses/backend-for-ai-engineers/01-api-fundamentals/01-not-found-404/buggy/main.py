"""Prompt library API: share prompt templates between our LLM features."""

from fastapi import FastAPI

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
    return prompts.get(prompt_id)
