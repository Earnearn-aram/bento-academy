"""pytest plugin: writes the bento-academy results JSON (see app/models.py TestRun).

Turns test outcomes into one readable line each:
- the check title is the test's docstring (first line);
- the message is the assert message, or a plain-English summary of the exception;
- the full traceback is kept in `details`, shown only on request.

Mark a test with @pytest.mark.best_practice to tag it in the UI.
"""

from __future__ import annotations

import json
import time

import pytest

_results: dict[str, dict] = {}
_order: list[str] = []
_errors: list[str] = []
_started = 0.0


def pytest_addoption(parser):
    parser.addoption("--bento-report", default=None, help="write bento-academy results JSON here")


def pytest_configure(config):
    global _started
    _started = time.monotonic()
    config.addinivalue_line("markers", "best_practice: the check verifies a production best practice")


def _title(item) -> str:
    doc = getattr(getattr(item, "function", None), "__doc__", None)
    if doc and doc.strip():
        return doc.strip().splitlines()[0]
    return item.name.removeprefix("test_").replace("_", " ").capitalize()


def friendly(excinfo) -> str:
    """One or two plain sentences instead of a traceback."""
    exc = excinfo.value
    name = type(exc).__name__
    text = str(exc).strip()
    if isinstance(exc, AssertionError):
        # pytest appends "assert <expr>" after the message; keep only the message.
        lines = [ln for ln in text.splitlines() if ln.strip()]
        msg_lines = []
        for ln in lines:
            if ln.lstrip().startswith(("assert ", "+", "-", "where ", "and ", "?")):
                break
            msg_lines.append(ln.strip())
        if msg_lines:
            return " ".join(msg_lines)
        return f"Check failed: {lines[0] if lines else 'assertion'}"
    if name == "Failed":  # pytest.fail(...) and pytest-timeout
        if "Timeout" in text:
            return "Took too long and was stopped. Is something blocking the event loop, waiting forever, or looping?"
        return text.splitlines()[0] if text else "Failed"
    first = text.splitlines()[0] if text else ""
    return f"Your code raised {name}: {first}" if first else f"Your code raised {name}"


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    rep.bento_title = _title(item)
    rep.bento_bp = item.get_closest_marker("best_practice") is not None
    rep.bento_msg = friendly(call.excinfo) if call.excinfo is not None and rep.failed else ""


def pytest_runtest_logreport(report):
    rid = report.nodeid
    if rid not in _results:
        _order.append(rid)
        _results[rid] = {
            "id": rid,
            "title": getattr(report, "bento_title", rid),
            "outcome": "passed",
            "message": "",
            "details": "",
            "best_practice": getattr(report, "bento_bp", False),
            "duration_s": 0.0,
        }
    entry = _results[rid]
    entry["duration_s"] += report.duration
    if report.skipped and report.when in ("setup", "call"):
        entry["outcome"] = "skipped"
        return
    if report.failed and entry["outcome"] == "passed":
        entry["outcome"] = "failed" if report.when == "call" else "error"
        entry["message"] = getattr(report, "bento_msg", "") or "Failed"
        entry["details"] = (report.longreprtext or "")[-6000:]


def pytest_collectreport(report):
    if report.failed:
        text = report.longreprtext or ""
        last = [ln for ln in text.splitlines() if ln.strip()][-1:] or ["could not collect tests"]
        _errors.append(f"Could not load the test file: {last[0].strip()}")
        _order.append(report.nodeid or "collect")
        _results[report.nodeid or "collect"] = {
            "id": report.nodeid or "collect",
            "title": "Test file loads",
            "outcome": "error",
            "message": f"Could not load the test file: {last[0].strip()}",
            "details": text[-6000:],
            "best_practice": False,
            "duration_s": 0.0,
        }


def pytest_sessionfinish(session, exitstatus):
    path = session.config.getoption("--bento-report")
    if not path:
        return
    checks = [_results[i] for i in _order]
    passed = sum(c["outcome"] == "passed" for c in checks)
    failed = sum(c["outcome"] in ("failed", "error") for c in checks)
    error = None
    if not checks:
        error = "No checks ran." if exitstatus != 0 else None
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "ok": failed == 0 and passed > 0,
                "passed": passed,
                "failed": failed,
                "checks": checks,
                "error": error,
                "duration_s": round(time.monotonic() - _started, 3),
            },
            fh,
        )
