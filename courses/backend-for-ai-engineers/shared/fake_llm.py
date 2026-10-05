"""A fake LLM so the course needs no API key.

It yields tokens with a small delay, like a real streaming model, and records
what happened (started, finished, cancelled) so tests can check behaviour such
as "the stream stopped when the client disconnected".
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

DEFAULT_TEXT = (
    "Sure. Here is a short answer, streamed one token at a time so you can see "
    "each piece arrive as soon as the model produces it."
)


class FakeLLM:
    def __init__(self, delay: float = 0.02, text: str = DEFAULT_TEXT):
        self.delay = delay
        self.text = text
        self.started = 0
        self.finished = 0
        self.cancelled = 0
        self.tokens_sent = 0

    def tokens(self, prompt: str) -> list[str]:
        words = self.text.split(" ")
        return [w + " " for w in words[:-1]] + [words[-1]]

    async def stream(self, prompt: str, max_tokens: int | None = None) -> AsyncIterator[str]:
        """Yield tokens one by one. Closing the generator early counts as a cancel."""
        self.started += 1
        completed = False
        try:
            for i, token in enumerate(self.tokens(prompt)):
                if max_tokens is not None and i >= max_tokens:
                    break
                await asyncio.sleep(self.delay)
                self.tokens_sent += 1
                yield token
            completed = True
        finally:
            if completed:
                self.finished += 1
            else:
                self.cancelled += 1

    async def complete(self, prompt: str) -> str:
        return "".join([t async for t in self.stream(prompt)])
