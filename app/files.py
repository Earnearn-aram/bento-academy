"""Your working copies in exercises/. They are plain files, so your IDE can edit them too."""

from __future__ import annotations

import hashlib
import os
import shutil
from pathlib import Path

from .models import Lesson

STARTER_STAMP = ".starter.sha"


class FileConflict(Exception):
    """The file changed on disk since the editor loaded it."""

    def __init__(self, disk_content: str, disk_mtime_ns: int):
        super().__init__("file changed on disk")
        self.disk_content = disk_content
        self.disk_mtime_ns = disk_mtime_ns


def editable_files(lesson: Lesson) -> list[str]:
    names = list(lesson.meta.files)
    if "prove" in lesson.steps and lesson.meta.prove_file not in names:
        names.append(lesson.meta.prove_file)
    return names


def _check_name(lesson: Lesson, name: str) -> None:
    # Only files the lesson declares, so a request can never reach outside exercises/.
    if name not in editable_files(lesson):
        raise KeyError(name)


def starter_hash(lesson: Lesson) -> str:
    h = hashlib.sha256()
    for name in editable_files(lesson):
        path = lesson.dir / "starter" / name
        h.update(name.encode())
        h.update(path.read_bytes() if path.is_file() else b"")
    return h.hexdigest()


def ensure_exercise(lesson: Lesson) -> None:
    """Create the working copy from the starter on first open. Never overwrites."""
    target = lesson.exercise_dir
    target.mkdir(parents=True, exist_ok=True)
    created = False
    for name in editable_files(lesson):
        dest = target / name
        src = lesson.dir / "starter" / name
        if not dest.exists() and src.is_file():
            shutil.copyfile(src, dest)
            created = True
    stamp = target / STARTER_STAMP
    if created or not stamp.exists():
        stamp.write_text(starter_hash(lesson))


def starter_changed(lesson: Lesson) -> bool:
    stamp = lesson.exercise_dir / STARTER_STAMP
    return stamp.is_file() and stamp.read_text().strip() != starter_hash(lesson)


def read_file(lesson: Lesson, name: str) -> tuple[str, int]:
    _check_name(lesson, name)
    path = lesson.exercise_dir / name
    if not path.is_file():
        return "", 0
    return path.read_text(encoding="utf-8"), path.stat().st_mtime_ns


def write_file(lesson: Lesson, name: str, content: str, base_mtime_ns: int | None) -> int:
    """Save editor content. If the file changed on disk after the editor loaded it
    (e.g. you edited it in your IDE) and the contents differ, refuse with FileConflict."""
    _check_name(lesson, name)
    path = lesson.exercise_dir / name
    path.parent.mkdir(parents=True, exist_ok=True)
    if base_mtime_ns is not None and path.is_file():
        disk_mtime = path.stat().st_mtime_ns
        if disk_mtime != base_mtime_ns:
            disk = path.read_text(encoding="utf-8")
            if disk != content:
                raise FileConflict(disk, disk_mtime)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)
    return path.stat().st_mtime_ns


def reset_files(lesson: Lesson, name: str | None = None) -> None:
    """Restore the starter (one file or all) and accept the current starter version."""
    names = [name] if name else editable_files(lesson)
    for n in names:
        _check_name(lesson, n)
        src = lesson.dir / "starter" / n
        if src.is_file():
            lesson.exercise_dir.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, lesson.exercise_dir / n)
    (lesson.exercise_dir / STARTER_STAMP).write_text(starter_hash(lesson))


def accept_starter(lesson: Lesson) -> None:
    """Keep your code but stop showing the 'starter changed' notice."""
    (lesson.exercise_dir / STARTER_STAMP).write_text(starter_hash(lesson))


def starter_file(lesson: Lesson, name: str) -> str:
    _check_name(lesson, name)
    path = lesson.dir / "starter" / name
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def solution_file(lesson: Lesson, name: str) -> str:
    _check_name(lesson, name)
    path: Path = lesson.solution_dir / name
    if not path.is_file() and name == lesson.meta.prove_file:
        path = lesson.dir / "tests" / "prove_reference.py"
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def mtimes(lesson: Lesson) -> dict[str, int]:
    out = {}
    for name in editable_files(lesson):
        path = lesson.exercise_dir / name
        out[name] = path.stat().st_mtime_ns if path.is_file() else 0
    return out
