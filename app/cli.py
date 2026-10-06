"""Small maintenance commands: reset progress, scaffold a lesson, download Monaco for offline use."""

from __future__ import annotations

import argparse
import io
import shutil
import sys
import tarfile
import textwrap
import urllib.request
from pathlib import Path

from . import discovery, progress
from .discovery import COURSES_DIR, EXERCISES_DIR, SOLUTIONS_DIR, sort_key

MONACO_VERSION = "0.52.2"


def cmd_reset(args) -> None:
    progress.reset(args.course)
    print(f"Progress reset{' for ' + args.course if args.course else ''}.")
    if args.exercises:
        target = EXERCISES_DIR / args.course if args.course else EXERCISES_DIR
        if target.exists():
            shutil.rmtree(target)
        print(f"Deleted your working copies in {target.relative_to(discovery.ROOT)}/ (they are recreated from the starters).")


def _find_dir(parent: Path, name: str, marker: str) -> Path:
    for d in parent.iterdir():
        if d.is_dir() and (d / marker).is_file() and (d.name == name or d.name.split("-", 1)[-1] == name):
            return d
    sys.exit(f"No folder {name!r} with {marker} under {parent}")


def cmd_new_lesson(args) -> None:
    course_dir = _find_dir(COURSES_DIR, args.course, "course.toml")
    module_dir = _find_dir(course_dir, args.module, "module.toml")
    existing = [d for d in module_dir.iterdir() if (d / "meta.toml").is_file()]
    number = max((sort_key(d)[0] for d in existing), default=0) + 1
    slug = args.name
    lesson_dir = module_dir / f"{number:02d}-{slug}"
    if lesson_dir.exists():
        sys.exit(f"{lesson_dir} already exists")
    files = {
        "meta.toml": f'id = "{slug}"\ntitle = "{slug.replace("-", " ").capitalize()}"\nsummary = ""\nminutes = 25\nversion = 1\n\n[[sources]]\ntitle = ""\nurl = ""\n',
        "lesson.md": "## The idea\n\n(Under 300 words.)\n\n## Worked example\n\n```python\n```\n",
        "task.md": "What to build or fix, as a short list.\n",
        "prove.md": "The bug to prove, in two sentences.\n",
        "hints.md": "Hint 1\n---\nHint 2\n---\nHint 3\n",
        "predict.toml": 'intro = ""\nsnippet = "predict/snippet.py"\n\n[[questions]]\nprompt = ""\noptions = ["", ""]\nanswer = 0\nexplain = ""\n',
        "predict/snippet.py": '"""Predict first, then run."""\n',
        "review.toml": 'title = ""\nauthor = "ai"\ndescription = ""\nmodel_review = ""\n\n[[issues]]\nid = ""\nlines = [1, 1]\nseverity = "blocker"\ncategory = "correctness"\ntitle = ""\nexplanation = ""\n',
        "interview.toml": '[[questions]]\nprompt = ""\nanswer = ""\n',
        "best_practice.md": "### In production\n\n### Common mistakes\n\n### Trade-offs\n\n### What breaks at scale\n\n### Security and reliability\n\n### Observability\n",
        "buggy/main.py": "# The pull request under review.\n",
        "starter/main.py": "# What the learner starts from.\n",
        "starter/test_prove.py": "def test_the_bug(client):\n    pass\n",
        "tests/test_core.py": "import pytest\n\n\ndef test_something(client):\n    \"\"\"One-line description shown in the UI\"\"\"\n    assert False, \"Readable failure message\"\n",
        "tests/prove_reference.py": "def test_the_bug(client):\n    assert False\n",
    }
    for rel, content in files.items():
        path = lesson_dir / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    solution = SOLUTIONS_DIR / lesson_dir.relative_to(COURSES_DIR) / "main.py"
    solution.parent.mkdir(parents=True, exist_ok=True)
    solution.write_text("# Reference solution: must pass tests/test_core.py (and test_stretch.py if present).\n")
    print(textwrap.dedent(f"""\
        Created {lesson_dir.relative_to(discovery.ROOT)}/ and {solution.relative_to(discovery.ROOT)}.
        Fill in the files, then run: make check-content"""))


def cmd_offline(_args) -> None:
    """Download Monaco once into app/vendor so the editor works without internet."""
    url = f"https://registry.npmjs.org/monaco-editor/-/monaco-editor-{MONACO_VERSION}.tgz"
    target = Path(__file__).parent / "vendor" / "monaco"
    print(f"Downloading Monaco {MONACO_VERSION} …")
    data = urllib.request.urlopen(url, timeout=120).read()
    if target.exists():
        shutil.rmtree(target)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        members = [m for m in tar.getmembers() if m.name.startswith("package/min/vs/")]
        for m in members:
            m.name = m.name.removeprefix("package/min/")
        tar.extractall(target, members=members, filter="data")
    print(f"Saved to {target.relative_to(discovery.ROOT)}/. Restart the app to use it.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(required=True)
    p = sub.add_parser("reset", help="reset progress (and optionally your exercise files)")
    p.add_argument("--course", default=None)
    p.add_argument("--exercises", action="store_true", help="also delete your working copies")
    p.set_defaults(fn=cmd_reset)
    p = sub.add_parser("new-lesson", help="scaffold a lesson folder")
    p.add_argument("course")
    p.add_argument("module")
    p.add_argument("name", help="lesson id, e.g. rate-limiting")
    p.set_defaults(fn=cmd_new_lesson)
    p = sub.add_parser("offline", help="download Monaco for offline use")
    p.set_defaults(fn=cmd_offline)
    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
