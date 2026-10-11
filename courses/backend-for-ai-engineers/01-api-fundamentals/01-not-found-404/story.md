Your team has a small **prompt library** API. The summarizer and the chatbot both load their prompt templates from it.

This morning the mobile app showed an **empty prompt editor**. Someone had asked for prompt `99`, which doesn't exist. Instead of saying "not found", the API answered **"OK"** with nothing inside.

Nothing crashed. The app just believed the API. This lesson fixes that.
