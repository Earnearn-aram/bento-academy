Your gateway's **prompt library** lets the summarizer and the chatbot share prompt templates. A junior dev built it last week. This morning, two odd bug reports came in:

- The mobile app showed an **empty prompt editor** instead of "Prompt not found". The API had answered `200 OK` with `null`, so the app thought the request worked.
- A prompt **vanished** after someone pasted its link in Slack. Slack fetched the link to build a preview, and the "delete" endpoint was a `GET`.

Nothing crashed, and every response looked successful. That's the problem: the API isn't telling clients **what actually happened**.
