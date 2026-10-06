"""Builds the course tree from folders. Adding content never needs code changes.

courses/<NN-course>/course.toml
courses/<NN-course>/<NN-module>/module.toml
courses/<NN-course>/<NN-module>/<NN-lesson>/meta.toml

The NN- prefix only sets the order. Stable ids live in the TOML files, so
renaming or reordering folders never loses your progress.
"""

from __future__ import annotations

import os
import re
import tomllib
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from .models import Course, CourseFile, Lesson, LessonFile, Module, ModuleFile

ROOT = Path(os.environ.get("BENTO_ROOT", Path(__file__).resolve().parents[1]))
COURSES_DIR = ROOT / "courses"
SOLUTIONS_DIR = ROOT / "solutions"
EXERCISES_DIR = ROOT / "exercises"

_PREFIX = re.compile(r"^(\d+)-(.+)$")
M = TypeVar("M", bound=BaseModel)


class ContentError(Exception):
    """A content file is missing or invalid. The message names the file."""


def sort_key(path: Path) -> tuple[int, str]:
    match = _PREFIX.match(path.name)
    return (int(match.group(1)), match.group(2)) if match else (10**6, path.name)


def load_toml(path: Path, model: type[M]) -> M:
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        return model.model_validate(data)
    except tomllib.TOMLDecodeError as exc:
        raise ContentError(f"{path}: invalid TOML: {exc}") from exc
    except ValidationError as exc:
        raise ContentError(f"{path}: {exc}") from exc


def _subdirs_with(path: Path, marker: str) -> list[Path]:
    return sorted((d for d in path.iterdir() if d.is_dir() and (d / marker).is_file()), key=sort_key)


def _fingerprint() -> tuple:
    stamps = []
    if COURSES_DIR.is_dir():
        for dirpath, _dirs, files in os.walk(COURSES_DIR):
            if ".venv" in dirpath:
                continue
            for name in files:
                if name.endswith(".toml"):
                    p = os.path.join(dirpath, name)
                    stamps.append((p, os.stat(p).st_mtime_ns))
    return tuple(sorted(stamps))


_cache: tuple[tuple, list[Course]] | None = None


def discover() -> list[Course]:
    """All courses, cached until any .toml under courses/ changes."""
    global _cache
    fp = _fingerprint()
    if _cache and _cache[0] == fp:
        return _cache[1]
    courses = [_load_course(d) for d in _subdirs_with(COURSES_DIR, "course.toml")] if COURSES_DIR.is_dir() else []
    ids = [c.meta.id for c in courses]
    if len(ids) != len(set(ids)):
        raise ContentError(f"duplicate course ids: {ids}")
    _cache = (fp, courses)
    return courses


def get_course(course_id: str) -> Course | None:
    return next((c for c in discover() if c.meta.id == course_id), None)


def _load_course(course_dir: Path) -> Course:
    meta = load_toml(course_dir / "course.toml", CourseFile)
    modules = []
    seen_lessons: set[str] = set()
    for module_dir in _subdirs_with(course_dir, "module.toml"):
        mmeta = load_toml(module_dir / "module.toml", ModuleFile)
        lessons = []
        for lesson_dir in _subdirs_with(module_dir, "meta.toml"):
            lmeta = load_toml(lesson_dir / "meta.toml", LessonFile)
            key = f"{mmeta.id}/{lmeta.id}"
            if key in seen_lessons:
                raise ContentError(f"{lesson_dir}: duplicate lesson id {key}")
            seen_lessons.add(key)
            rel = lesson_dir.relative_to(COURSES_DIR)
            lessons.append(
                Lesson(
                    meta=lmeta,
                    course_id=meta.id,
                    module_id=mmeta.id,
                    dir=lesson_dir,
                    solution_dir=SOLUTIONS_DIR / rel,
                    exercise_dir=EXERCISES_DIR / meta.id / mmeta.id / lmeta.id,
                    steps=lmeta.steps or meta.steps.default,
                )
            )
        modules.append(
            Module(
                meta=mmeta,
                dir=module_dir,
                lessons=lessons,
                has_quiz=(module_dir / "quiz.toml").is_file(),
                has_design=(module_dir / "design.md").is_file(),
            )
        )
    return Course(meta=meta, dir=course_dir, modules=modules)
