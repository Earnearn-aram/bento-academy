"""Shared pytest fixtures for every lesson in this course (loaded with `-p course_fixtures`).

Tests never import your code directly. They get it through the `target` fixture,
which loads main.py from whichever folder the runner points at:
your exercises/ copy, the reference solution, or the buggy PR.
"""

from __future__ import annotations

import importlib.util
import sys
import uuid
from pathlib import Path

import pytest


def pytest_addoption(parser):
    parser.addoption("--target", default=None, help="folder that contains the code under test")
    parser.addoption("--entry", default="main.py", help="entry module inside --target")


@pytest.fixture
def target_dir(request) -> Path:
    value = request.config.getoption("--target")
    if not value:
        pytest.fail("No --target given: run tests through bento-academy or `make check-content`.", pytrace=False)
    return Path(value).resolve()


@pytest.fixture
def target(request, target_dir):
    """Your module, freshly imported for every test so in-memory state starts clean."""
    entry = target_dir / request.config.getoption("--entry")
    if not entry.is_file():
        pytest.fail(f"Could not find {entry.name} in {target_dir}", pytrace=False)
    name = f"bento_target_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(name, entry)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    sys.path.insert(0, str(target_dir))
    try:
        spec.loader.exec_module(module)
    except Exception as exc:  # syntax errors, bad imports, ...
        line = getattr(exc, "lineno", None)
        where = f" (line {line})" if line else ""
        pytest.fail(f"Your code failed to load: {type(exc).__name__}: {exc}{where}", pytrace=False)
    finally:
        sys.path.remove(str(target_dir))
    yield module
    sys.modules.pop(name, None)


@pytest.fixture
def client(target):
    """A TestClient for `target.app`. Server errors come back as 500 responses, like in production."""
    from fastapi.testclient import TestClient

    if not hasattr(target, "app"):
        pytest.fail("Your module has no `app` object.", pytrace=False)
    with TestClient(target.app, raise_server_exceptions=False) as c:
        yield c
