🍱 bento-academy: learn one small box at a time.

A local, Codecademy-style app for learning by doing. Each lesson is one small idea. You predict what some code does, review a pull request, fix it until real tests pass, write a test that proves the bug, and then defend your design like in a senior interview.

First course: **Backend for AI engineers** (APIs, streaming, SSE, WebSocket, webhooks, and a capstone).

> Status: milestone 0. The app and lesson 1.1 are ready; the rest of the course is being added module by module.

## Start

You need [uv](https://docs.astral.sh/uv/) and `make`.

```bash
make start            # installs everything with uv, starts the app, opens http://127.0.0.1:8000
make start PORT=9000  # if port 8000 is taken
```

The code editor (Monaco) and fonts load from a CDN. Without internet, run `make offline` once to download the editor. The app still works without that, using a plain text editor and system fonts.

## Where your code lives

Your working copies are normal files in `exercises/<course>/<module>/<lesson>/`. Edit them in the browser or in your own IDE: the two stay in sync. If you change a file in your IDE while you have unsaved edits in the browser, the app asks which version to keep.

## Reset

```bash
make reset       # reset progress, keep your code
make reset-all   # reset progress and delete your exercise files (asks first)
```

Inside a lesson, **Reset** restores just that lesson's starter code.

## Other commands

```bash
make check-content   # verify every lesson: solutions pass, starters fail, the Prove step works
make test-app        # the app's own tests
make help
```

How to add a lesson or a whole new course: coming in the final README. In short, it only takes new files under `courses/`, with no app code changes.
