"""Prompt library API: store reusable prompt templates for our LLM features."""

from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel

app = FastAPI()


class PromptIn(BaseModel):
    name: str
    template: str


class Prompt(PromptIn):
    id: int


prompts: dict[int, Prompt] = {}
next_id = 1


def get_or_404(prompt_id: int) -> Prompt:
    prompt = prompts.get(prompt_id)
    if prompt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Prompt {prompt_id} not found")
    return prompt


def ensure_name_free(name: str, except_id: int | None = None) -> None:
    if any(p.name == name and p.id != except_id for p in prompts.values()):
        raise HTTPException(status.HTTP_409_CONFLICT, f"A prompt named {name!r} already exists")


@app.get("/prompts")
def list_prompts() -> list[Prompt]:
    return list(prompts.values())


@app.post("/prompts", status_code=status.HTTP_201_CREATED)
def create_prompt(body: PromptIn, response: Response) -> Prompt:
    global next_id
    ensure_name_free(body.name)
    prompt = Prompt(id=next_id, **body.model_dump())
    prompts[prompt.id] = prompt
    next_id += 1
    response.headers["Location"] = f"/prompts/{prompt.id}"
    return prompt


@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: int) -> Prompt:
    return get_or_404(prompt_id)


@app.put("/prompts/{prompt_id}")
def replace_prompt(prompt_id: int, body: PromptIn) -> Prompt:
    get_or_404(prompt_id)  # ids are assigned by the server, so PUT only replaces
    ensure_name_free(body.name, except_id=prompt_id)
    prompts[prompt_id] = Prompt(id=prompt_id, **body.model_dump())
    return prompts[prompt_id]


@app.delete("/prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(prompt_id: int) -> None:
    get_or_404(prompt_id)
    del prompts[prompt_id]
