"""App tests run against a copy of the repo content in a temp folder, so they never
touch your real progress.json or exercises/."""

import os
import shutil
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SANDBOX = Path(tempfile.mkdtemp(prefix="bento-app-tests-"))


def _copy_content() -> None:
    for name in ("courses", "solutions", "tools"):
        shutil.copytree(REPO / name, SANDBOX / name, ignore=shutil.ignore_patterns(".venv", "__pycache__"))
    # Reuse each course's installed environment instead of creating a new one.
    for venv in (REPO / "courses").glob("*/.venv"):
        (SANDBOX / "courses" / venv.parent.name / ".venv").symlink_to(venv)


_copy_content()
os.environ["BENTO_ROOT"] = str(SANDBOX)
os.environ["BENTO_PROGRESS"] = str(SANDBOX / "progress.json")
sys.path.insert(0, str(REPO))


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(SANDBOX, ignore_errors=True)
