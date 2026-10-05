"""`make start`: install each course's dependencies, start the server, open the browser."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

import uvicorn

from . import discovery


def setup_courses() -> None:
    for course in discovery.discover():
        cmd = [t.format(course_dir=course.dir) for t in course.meta.env.setup]
        if not cmd:
            continue
        if shutil.which(cmd[0]) is None:
            sys.exit(f"`{cmd[0]}` is not installed; it is needed for the course {course.meta.title!r}.")
        print(f"🍱 Preparing {course.meta.title} …", flush=True)
        result = subprocess.run(cmd, cwd=course.dir)
        if result.returncode != 0:
            sys.exit(f"Setting up {course.meta.title!r} failed (exit code {result.returncode}).")


def open_when_ready(url: str) -> None:
    for _ in range(100):
        try:
            urllib.request.urlopen(url + "api/config", timeout=1)
            webbrowser.open(url)
            return
        except OSError:
            time.sleep(0.2)


def main() -> None:
    parser = argparse.ArgumentParser(prog="bento-academy")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1", help="keep 127.0.0.1: the app runs your code")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--skip-setup", action="store_true")
    args = parser.parse_args()
    if not args.skip_setup:
        setup_courses()
    url = f"http://{args.host}:{args.port}/"
    print(f"🍱 bento-academy is running at {url}  (Ctrl+C to stop)", flush=True)
    if not args.no_browser:
        threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()
    uvicorn.run("app.server:app", host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
