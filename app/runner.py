"""Runs a lesson's tests with the command its course declares, and reads the results JSON."""

from __future__ import annotations

import asyncio
import os
import tempfile
import time
from pathlib import Path

from .discovery import ROOT
from .models import Check, Course, Lesson, ProveResult, TestRun

TOOLS_DIR = ROOT / "tools"


def _expand(command: list[str], **values) -> list[str]:
    out: list[str] = []
    for token in command:
        if token == "{tests}":
            out.extend(str(t) for t in values["tests"])
        else:
            out.append(token.format(**{k: v for k, v in values.items() if k != "tests"}))
    return out


def _env(course: Course) -> dict[str, str]:
    env = dict(os.environ)
    # tools/ holds the results plugin; the course dir holds shared helpers and fixtures.
    parts = [str(TOOLS_DIR), str(course.dir), env.get("PYTHONPATH", "")]
    env["PYTHONPATH"] = os.pathsep.join(p for p in parts if p)
    env.pop("VIRTUAL_ENV", None)  # let uv pick the course's own environment
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def _error_run(message: str, output: str = "", started: float = 0.0) -> TestRun:
    return TestRun(
        ok=False,
        passed=0,
        failed=1,
        error=message,
        checks=[Check(id="run", title="Tests ran", outcome="error", message=message, details=output[-6000:])],
        duration_s=round(time.monotonic() - started, 3) if started else 0.0,
    )


async def run_tests(course: Course, code_dir: Path, tests: list[Path]) -> TestRun:
    """Run `tests` against the code in `code_dir`. Never raises: problems become a failed TestRun."""
    missing = [t for t in tests if not t.is_file()]
    if missing:
        return _error_run(f"Test file not found: {missing[0].name}")
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="bento-") as tmp:
        report = Path(tmp) / "report.json"
        cmd = _expand(
            course.meta.tests.command,
            course_dir=course.dir,
            code_dir=code_dir,
            report=report,
            tests=tests,
        )
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=course.dir,
                env=_env(course),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
        except FileNotFoundError:
            return _error_run(f"Could not start the test command `{cmd[0]}`. Is it installed and on PATH?")
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=course.meta.tests.timeout_s)
        except TimeoutError:
            proc.kill()
            await proc.wait()
            return _error_run(
                f"The tests took longer than {course.meta.tests.timeout_s}s and were stopped. "
                "Is something waiting forever or blocking the event loop?",
                started=started,
            )
        output = out.decode(errors="replace")
        if not report.is_file():
            tail = [ln for ln in output.splitlines() if ln.strip()][-1:] or ["no output"]
            return _error_run(f"The test run crashed: {tail[0]}", output, started)
        run = TestRun.model_validate_json(report.read_text(encoding="utf-8"))
        if run.error and not run.checks:
            return _error_run(run.error, output, started)
        return run


def lesson_tests(lesson: Lesson, kind: str) -> list[Path]:
    name = {"core": "test_core.py", "stretch": "test_stretch.py"}[kind]
    return [lesson.dir / "tests" / name]


async def prove(course: Course, lesson: Lesson, test_file: Path) -> ProveResult:
    """Your test must FAIL on the buggy PR (it catches the bug) and PASS on the
    reference solution (it doesn't reject correct code)."""
    buggy_dir = lesson.dir / "buggy"
    vs_buggy, vs_solution = await asyncio.gather(
        run_tests(course, buggy_dir, [test_file]),
        run_tests(course, lesson.solution_dir, [test_file]),
    )
    broken = next((c for c in vs_buggy.checks if c.id in ("run", "collect") or c.title == "Test file loads"), None)
    if broken:
        ok, message = False, broken.message
    elif vs_buggy.passed + vs_buggy.failed == 0:
        ok, message = False, "Your file has no tests. Write a function whose name starts with test_."
    elif vs_buggy.failed == 0:
        ok, message = False, "Your test passed on the buggy PR, so it doesn't catch the bug yet."
    elif not vs_solution.ok:
        ok, message = False, "Your test fails on the correct solution too. It is checking something the fix doesn't do."
    else:
        ok, message = True, "Your test fails on the buggy PR and passes on the fix. It proves the bug."
    return ProveResult(ok=ok, message=message, against_buggy=vs_buggy, against_solution=vs_solution)


async def run_snippet(course: Course, snippet: Path, timeout_s: int = 30) -> tuple[bool, str]:
    """Run a predict-step snippet with the course's Python and return its output."""
    cmd = ["uv", "run", "--no-sync", "--quiet", "--project", str(course.dir), "python", str(snippet)]
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=course.dir, env=_env(course), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
    except TimeoutError:
        proc.kill()
        await proc.wait()
        return False, f"Stopped after {timeout_s}s."
    return proc.returncode == 0, out.decode(errors="replace")
