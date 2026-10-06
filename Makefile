# bento-academy: every command runs through uv, so the right Python and packages are used.
PORT ?= 8000

.PHONY: start check-content test-solutions test-app reset reset-all new-lesson offline help

help:
	@echo "make start            install course deps, start the app, open the browser (PORT=8000)"
	@echo "make check-content    verify every lesson: solutions pass, starters fail, prove-it works"
	@echo "make test-solutions   only run each reference solution against its tests"
	@echo "make test-app         run the app's own tests"
	@echo "make reset            reset progress (keeps your code)"
	@echo "make reset-all        reset progress AND delete your exercise files"
	@echo "make new-lesson COURSE=backend-for-ai-engineers MODULE=api-fundamentals NAME=my-lesson"
	@echo "make offline          download the code editor so it works without internet"

start:
	uv run python -m app --port $(PORT)

check-content:
	uv run python -m app.check

test-solutions:
	uv run python -m app.check --solutions-only

test-app:
	uv run pytest

reset:
	uv run python -m app.cli reset

reset-all:
	@read -p "Delete progress AND your exercise files? [y/N] " ans; [ "$$ans" = "y" ] && uv run python -m app.cli reset --exercises || echo "Cancelled."

new-lesson:
	uv run python -m app.cli new-lesson $(COURSE) $(MODULE) $(NAME)

offline:
	uv run python -m app.cli offline
