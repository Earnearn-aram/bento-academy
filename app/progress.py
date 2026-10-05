"""progress.json: your progress, saved locally with atomic writes."""

from __future__ import annotations

import os
import threading
from pathlib import Path

from .discovery import ROOT
from .models import CourseProgress, Lesson, LessonProgress, Progress, QuizProgress, StepState

PROGRESS_FILE = Path(os.environ.get("BENTO_PROGRESS", ROOT / "progress.json"))
_lock = threading.Lock()


def load() -> Progress:
    if not PROGRESS_FILE.is_file():
        return Progress()
    try:
        return Progress.model_validate_json(PROGRESS_FILE.read_text(encoding="utf-8"))
    except ValueError:
        # A corrupt file should not brick the app; keep a copy and start fresh.
        PROGRESS_FILE.replace(PROGRESS_FILE.with_suffix(".corrupt.json"))
        return Progress()


def save(progress: Progress) -> None:
    tmp = PROGRESS_FILE.with_suffix(".json.tmp")
    tmp.write_text(progress.model_dump_json(indent=2), encoding="utf-8")
    os.replace(tmp, PROGRESS_FILE)  # atomic: never a half-written progress file


def course(progress: Progress, course_id: str) -> CourseProgress:
    return progress.courses.setdefault(course_id, CourseProgress())


def lesson(progress: Progress, course_id: str, lesson_key: str) -> LessonProgress:
    return course(progress, course_id).lessons.setdefault(lesson_key, LessonProgress())


def update_lesson(les: Lesson, fn) -> LessonProgress:
    """Load, apply fn(LessonProgress), recompute completion, save. Returns the new state."""
    with _lock:
        prog = load()
        lp = lesson(prog, les.course_id, les.key)
        fn(lp)
        if all(lp.steps.get(s) and lp.steps[s].done for s in les.steps):
            if not lp.completed:
                lp.completed = True
            lp.completed_version = les.meta.version
        save(prog)
        return lp


def mark_step(les: Lesson, step: str, done: bool = True, **data) -> LessonProgress:
    def apply(lp: LessonProgress) -> None:
        state = lp.steps.setdefault(step, StepState())
        state.done = state.done or done
        state.data.update(data)

    return update_lesson(les, apply)


def set_last(course_id: str, lesson_key: str, step: str) -> None:
    with _lock:
        prog = load()
        cp = course(prog, course_id)
        cp.last_lesson, cp.last_step = lesson_key, step
        save(prog)


def reset(course_id: str | None = None) -> None:
    with _lock:
        if course_id is None:
            PROGRESS_FILE.unlink(missing_ok=True)
            return
        prog = load()
        prog.courses.pop(course_id, None)
        save(prog)


def save_quiz(course_id: str, module_id: str, quiz: QuizProgress) -> None:
    with _lock:
        prog = load()
        course(prog, course_id).quizzes[module_id] = quiz
        save(prog)


def mark_design_viewed(course_id: str, module_id: str) -> None:
    with _lock:
        prog = load()
        cp = course(prog, course_id)
        if module_id not in cp.designs_viewed:
            cp.designs_viewed.append(module_id)
            save(prog)
