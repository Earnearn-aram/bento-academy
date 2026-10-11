On bad Wi-Fi, the mobile app **retries** a request when it doesn't hear back.

One evening it sent `PUT /prompts/42` to save an edit, but prompt 42 had been deleted. The API quietly **created** a new prompt 42 instead.

The next day, `POST` handed out id 42 again and **overwrote** it. Someone's prompt vanished.
