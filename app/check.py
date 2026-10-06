"""`make check-content`: proves every lesson is teachable before you see it.

For each lesson:
  1. all content files are valid (TOML against the Pydantic models, required files exist);
  2. the reference solution passes the core tests, and the stretch tests if any;
  3. the untouched starter fails at least one core test (otherwise there is nothing to do);
  4. the buggy PR fails at least one best-practice test;
  5. the reference prove test fails on the buggy PR and passes on the solution;
  6. the starter prove file does NOT already prove the bug;
  7. review line numbers point inside the reviewed file; lesson text stays under 300 words.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys

from . import discovery, runner
from .discovery import ContentError, load_toml
from .models import Course, InterviewFile, Lesson, PredictFile, QuizFile, ReviewFile

REQUIRED = ["lesson.md", "task.md", "hints.md", "interview.toml", "best_practice.md", "tests/test_core.py"]


def word_count(markdown: str) -> int:
    concept = markdown.split("## Worked example")[0]
    concept = re.sub(r"```.*?```", "", concept, flags=re.S)
    return len(re.findall(r"[A-Za-z0-9`'’-]+", concept))


async def check_lesson(course: Course, lesson: Lesson, solutions_only: bool) -> list[str]:
    errors: list[str] = []
    d = lesson.dir
    for rel in REQUIRED:
        if not (d / rel).is_file():
            errors.append(f"missing {rel}")
    for name in lesson.meta.files:
        if not (lesson.solution_dir / name).is_file():
            errors.append(f"missing solution {lesson.solution_dir.relative_to(discovery.ROOT)}/{name}")
        if not (d / "starter" / name).is_file():
            errors.append(f"missing starter/{name}")
    try:
        if (d / "interview.toml").is_file():
            load_toml(d / "interview.toml", InterviewFile)
        if (d / "check.toml").is_file():
            load_toml(d / "check.toml", QuizFile)
        if "predict" in lesson.steps:
            pf = load_toml(d / "predict.toml", PredictFile)
            if not (d / pf.snippet).is_file():
                errors.append(f"missing {pf.snippet}")
        if "review" in lesson.steps:
            rf = load_toml(d / "review.toml", ReviewFile)
            n = len((d / rf.file).read_text().splitlines())
            for issue in rf.issues:
                if not (1 <= issue.lines[0] <= issue.lines[1] <= n):
                    errors.append(f"review issue {issue.id}: lines {issue.lines} outside {rf.file} (1-{n})")
    except (ContentError, FileNotFoundError) as exc:
        errors.append(str(exc))
    if (d / "lesson.md").is_file() and (words := word_count((d / "lesson.md").read_text())) > 300:
        errors.append(f"lesson.md explanation is {words} words (limit 300)")
    if errors:
        return errors

    core = runner.lesson_tests(lesson, "core")
    sol = await runner.run_tests(course, lesson.solution_dir, core)
    if not sol.ok:
        bad = [f"{c.title}: {c.message}" for c in sol.checks if not c.passed]
        errors.append("solution fails core tests: " + "; ".join(bad or [sol.error or "?"]))
    stretch = runner.lesson_tests(lesson, "stretch")
    if stretch[0].is_file():
        st = await runner.run_tests(course, lesson.solution_dir, stretch)
        if not st.ok:
            errors.append("solution fails stretch tests: " + "; ".join(f"{c.title}: {c.message}" for c in st.checks if not c.passed))
    if solutions_only:
        return errors

    starter = await runner.run_tests(course, d / "starter", core)
    if starter.ok:
        errors.append("the untouched starter already passes every core test")
    if (d / "buggy").is_dir():
        buggy = await runner.run_tests(course, d / "buggy", core)
        if not any(c.best_practice and not c.passed for c in buggy.checks):
            errors.append("the buggy PR passes every best-practice test (it should fail at least one)")
    if "prove" in lesson.steps:
        ref = await runner.prove(course, lesson, d / "tests" / "prove_reference.py")
        if not ref.ok:
            errors.append(f"prove_reference.py does not prove the bug: {ref.message}")
        starter_prove = d / "starter" / lesson.meta.prove_file
        if starter_prove.is_file() and (await runner.prove(course, lesson, starter_prove)).ok:
            errors.append(f"starter/{lesson.meta.prove_file} already proves the bug")
    return errors


async def main_async(solutions_only: bool, only: str | None) -> int:
    failures = 0
    total = 0
    for course in discovery.discover():
        print(f"\n🍱 {course.meta.title}")
        for module in course.modules:
            for name in ("quiz.toml", "intro_check.toml"):
                if (module.dir / name).is_file():
                    try:
                        load_toml(module.dir / name, QuizFile)
                    except ContentError as exc:
                        failures += 1
                        print(f"  ✗ {module.meta.id} {name}: {exc}")
            for lesson in module.lessons:
                if only and only not in lesson.key:
                    continue
                total += 1
                errors = await check_lesson(course, lesson, solutions_only)
                mark = "✓" if not errors else "✗"
                print(f"  {mark} {lesson.key}")
                for e in errors:
                    print(f"      - {e}")
                failures += bool(errors)
    print(f"\n{total - failures} of {total} lessons OK." if total else "\nNo lessons found.")
    return 1 if failures else 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.check")
    parser.add_argument("--solutions-only", action="store_true", help="only run solutions against their tests")
    parser.add_argument("--only", default=None, help="substring of a lesson key, e.g. methods-and-status")
    args = parser.parse_args()
    try:
        sys.exit(asyncio.run(main_async(args.solutions_only, args.only)))
    except ContentError as exc:
        sys.exit(f"Content error: {exc}")


if __name__ == "__main__":
    main()
