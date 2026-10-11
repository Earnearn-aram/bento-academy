The chatbot team can now **add** prompts to the library with `POST /prompts`.

Their code waits for a reply that says *"created"*, then opens the new prompt. But the API answers a plain **`200 OK`**, and it never says *where* the new prompt lives. So their code has to guess the address, and it guessed wrong twice this week.
