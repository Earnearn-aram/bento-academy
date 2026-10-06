"""bento-academy web server: serves the UI and a small JSON API. Local use only."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterable
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.sse import EventSourceResponse, ServerSentEvent
from fastapi.staticfiles import StaticFiles
from markdown_it import MarkdownIt
from pydantic import BaseModel

from . import discovery, files, progress, review, runner
from .discovery import ContentError, load_toml
from .models import (
    Course,
    InterviewFile,
    Lesson,
    PredictFile,
    QuizFile,
    QuizProgress,
    ReviewComment,
    ReviewFile,
)

STATIC = Path(__file__).parent / "static"
VENDOR = Path(__file__).parent / "vendor"
md = MarkdownIt("commonmark", {"html": True}).enable("table")

app = FastAPI(title="bento-academy", docs_url="/api/docs", redoc_url=None)


@app.exception_handler(ContentError)
async def content_error(_request: Request, exc: ContentError) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": f"Content error: {exc}"})


# ---------------------------------------------------------------- helpers


def html(text: str) -> str:
    return md.render(text)


def read_md(path: Path) -> str | None:
    return html(path.read_text(encoding="utf-8")) if path.is_file() else None


def get_course_or_404(course_id: str) -> Course:
    course = discovery.get_course(course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No course {course_id!r}")
    return course


def get_lesson_or_404(course_id: str, module_id: str, lesson_id: str) -> tuple[Course, Lesson]:
    course = get_course_or_404(course_id)
    lesson = course.find(module_id, lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No lesson {module_id}/{lesson_id}")
    return course, lesson


def lesson_ref(lesson: Lesson | None) -> dict | None:
    if lesson is None:
        return None
    return {"module": lesson.module_id, "lesson": lesson.meta.id, "title": lesson.meta.title}


def course_summary(course: Course) -> dict:
    prog = progress.course(progress.load(), course.meta.id)
    modules = []
    review_found = review_total = 0
    for m in course.modules:
        done = sum(1 for les in m.lessons if prog.lessons.get(les.key) and prog.lessons[les.key].completed)
        modules.append(
            {
                "id": m.meta.id,
                "title": m.meta.title,
                "short": m.meta.short or m.meta.title,
                "icon": m.meta.icon,
                "done": done,
                "total": len(m.lessons),
                "has_quiz": m.has_quiz,
                "has_design": m.has_design,
                "quiz_done": m.meta.id in prog.quizzes,
                "design_viewed": m.meta.id in prog.designs_viewed,
                "lessons": [
                    {
                        "id": les.meta.id,
                        "title": les.meta.title,
                        "done": bool(prog.lessons.get(les.key) and prog.lessons[les.key].completed),
                        "updated": bool(
                            prog.lessons.get(les.key)
                            and prog.lessons[les.key].completed
                            and (prog.lessons[les.key].completed_version or 0) < les.meta.version
                        ),
                    }
                    for les in m.lessons
                ],
            }
        )
        for les in m.lessons:
            lp = prog.lessons.get(les.key)
            data = lp.steps.get("review").data if lp and lp.steps.get("review") else None
            if data and "found" in data:
                review_found += data["found"]
                review_total += data["total"]
    lessons = course.lessons()
    last = None
    if prog.last_lesson:
        mid, _, lid = prog.last_lesson.partition("/")
        les = course.find(mid, lid)
        if les:
            last = {**lesson_ref(les), "step": prog.last_step or les.steps[0]}
    with_lessons = [m for m in modules if m["total"]]
    current = next((m for m in with_lessons if m["done"] < m["total"]), with_lessons[-1] if with_lessons else None)
    return {
        "id": course.meta.id,
        "title": course.meta.title,
        "description": course.meta.description,
        "lessons_total": len(lessons),
        "lessons_done": sum(m["done"] for m in modules),
        "quizzes_total": sum(1 for m in course.modules if m.has_quiz),
        "quizzes_done": len(prog.quizzes),
        "review_accuracy": round(100 * review_found / review_total) if review_total else None,
        "current_module": current["short"] if current else None,
        "modules": modules,
        "last": last,
    }


@app.get("/api/config")
def config() -> dict:
    return {"monaco_local": (VENDOR / "monaco" / "vs" / "loader.js").is_file()}


# ---------------------------------------------------------------- courses


@app.get("/api/courses")
def list_courses() -> list[dict]:
    return [course_summary(c) for c in discovery.discover()]


@app.get("/api/courses/{course_id}")
def get_course(course_id: str) -> dict:
    return course_summary(get_course_or_404(course_id))


# ---------------------------------------------------------------- lessons


@app.get("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}")
def get_lesson(course_id: str, module_id: str, lesson_id: str) -> dict:
    course, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    module = course.module(module_id)
    files.ensure_exercise(lesson)
    d = lesson.dir
    all_lessons = course.lessons()
    idx = next(i for i, les in enumerate(all_lessons) if les.key == lesson.key)

    predict = None
    if "predict" in lesson.steps and (d / "predict.toml").is_file():
        pf = load_toml(d / "predict.toml", PredictFile)
        snippet = d / pf.snippet
        predict = {
            "intro": html(pf.intro) if pf.intro else "",
            "code": snippet.read_text(encoding="utf-8") if snippet.is_file() else "",
            "runnable": pf.runnable and snippet.is_file(),
            "questions": [{"prompt": html(q.prompt), "options": [html(o) for o in q.options]} for q in pf.questions],
        }

    review_data = None
    if "review" in lesson.steps and (d / "review.toml").is_file():
        rf = load_toml(d / "review.toml", ReviewFile)
        review_data = {
            "title": rf.title,
            "author": rf.author,
            "description": html(rf.description),
            "goal": rf.goal,
            "file": Path(rf.file).name,
            "code": (d / rf.file).read_text(encoding="utf-8"),
            "issue_count": len(rf.issues),
        }

    interview = []
    if (d / "interview.toml").is_file():
        interview = [
            {"prompt": html(q.prompt), "answer": html(q.answer)}
            for q in load_toml(d / "interview.toml", InterviewFile).questions
        ]

    hints_md = (d / "hints.md").read_text(encoding="utf-8") if (d / "hints.md").is_file() else ""
    hints = [html(h.strip()) for h in hints_md.split("\n---\n") if h.strip()][:3]

    editable = files.editable_files(lesson)
    file_payload = []
    for name in editable:
        content, mtime = files.read_file(lesson, name)
        file_payload.append({"name": name, "content": content, "mtime_ns": str(mtime)})

    prog = progress.lesson(progress.load(), course.meta.id, lesson.key)
    return {
        "course": {"id": course.meta.id, "title": course.meta.title},
        "module": {"id": module.meta.id, "title": module.meta.title, "icon": module.meta.icon},
        "lesson": {
            "key": lesson.key,
            "id": lesson.meta.id,
            "title": lesson.meta.title,
            "summary": lesson.meta.summary,
            "minutes": lesson.meta.minutes,
            "version": lesson.meta.version,
            "steps": lesson.steps,
        },
        "prev": lesson_ref(all_lessons[idx - 1]) if idx > 0 else None,
        "next": lesson_ref(all_lessons[idx + 1]) if idx + 1 < len(all_lessons) else None,
        "concept": read_md(d / "lesson.md") or "",
        "task": read_md(d / "task.md") or "",
        "prove_task": read_md(d / "prove.md"),
        "hints": hints,
        "best_practice": read_md(d / "best_practice.md"),
        "stretch": read_md(d / "stretch.md"),
        "has_stretch_tests": (d / "tests" / "test_stretch.py").is_file(),
        "predict": predict,
        "review": review_data,
        "interview": interview,
        "sources": [s.model_dump() for s in lesson.meta.sources],
        "files": file_payload,
        "entry_file": lesson.meta.files[0],
        "prove_file": lesson.meta.prove_file if "prove" in lesson.steps else None,
        "exercise_dir": str(lesson.exercise_dir.relative_to(discovery.ROOT)),
        "starter_changed": files.starter_changed(lesson),
        "progress": prog.model_dump(),
    }


class StepBody(BaseModel):
    step: str


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/visit")
def visit(course_id: str, module_id: str, lesson_id: str, body: StepBody) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    progress.set_last(course_id, lesson.key, body.step)
    return {"ok": True}


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/steps/{step}/done")
def step_done(course_id: str, module_id: str, lesson_id: str, step: str) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    if step not in ("concept", "defend") or step not in lesson.steps:
        # The other steps are completed by passing their check, not by clicking.
        raise HTTPException(status.HTTP_409_CONFLICT, f"Step {step!r} is completed by its check")
    return progress.mark_step(lesson, step).model_dump()


class HintBody(BaseModel):
    shown: int


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/hints")
def hints_shown(course_id: str, module_id: str, lesson_id: str, body: HintBody) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)

    def apply(lp):
        lp.hints_shown = max(lp.hints_shown, min(body.shown, 3))

    return progress.update_lesson(lesson, apply).model_dump()


# --- predict


class PredictBody(BaseModel):
    answers: list[int | None]


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/predict")
def submit_predict(course_id: str, module_id: str, lesson_id: str, body: PredictBody) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    pf = load_toml(lesson.dir / "predict.toml", PredictFile)
    if len(body.answers) != len(pf.questions):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Answer every question")
    results = [
        {"correct": a == q.answer, "answer": q.answer, "explain": html(q.explain)}
        for a, q in zip(body.answers, pf.questions, strict=True)
    ]
    score = sum(r["correct"] for r in results)
    lp = progress.mark_step(lesson, "predict", answers=body.answers, score=score, total=len(results))
    return {"results": results, "score": score, "total": len(results), "progress": lp.model_dump()}


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/predict/run")
async def run_predict(course_id: str, module_id: str, lesson_id: str) -> dict:
    course, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    pf = load_toml(lesson.dir / "predict.toml", PredictFile)
    ok, output = await runner.run_snippet(course, lesson.dir / pf.snippet)
    return {"ok": ok, "output": output}


# --- review


class ReviewBody(BaseModel):
    comments: list[ReviewComment]


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/review")
def submit_review(course_id: str, module_id: str, lesson_id: str, body: ReviewBody) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    rf = load_toml(lesson.dir / "review.toml", ReviewFile)
    result = review.grade(rf, body.comments)
    result_dump = result.model_dump()
    for r in result_dump["issues"]:
        r["issue"]["explanation"] = html(r["issue"]["explanation"])
    result_dump["model_review"] = html(result.model_review)
    result_dump["teaching_comment"] = html(result.teaching_comment) if result.teaching_comment else None
    found = sum(result.found.values())
    total = sum(result.total.values())
    lp = progress.mark_step(
        lesson,
        "review",
        found=found,
        total=total,
        found_by_severity=result.found,
        false_alarms=len(result.false_alarms),
        comments=[c.model_dump() for c in body.comments],
    )
    return {**result_dump, "progress": lp.model_dump()}


# --- files


class FileBody(BaseModel):
    content: str
    # Nanosecond timestamps are sent as strings: they don't fit in a JavaScript number.
    base_mtime_ns: str | None = None


@app.get("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/files/{name}")
def read_exercise_file(course_id: str, module_id: str, lesson_id: str, name: str) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    try:
        content, mtime = files.read_file(lesson, name)
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{name} is not part of this lesson") from None
    return {"name": name, "content": content, "mtime_ns": str(mtime)}


@app.put("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/files/{name}")
def write_exercise_file(course_id: str, module_id: str, lesson_id: str, name: str, body: FileBody) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    try:
        mtime = files.write_file(lesson, name, body.content, int(body.base_mtime_ns) if body.base_mtime_ns else None)
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{name} is not part of this lesson") from None
    except files.FileConflict as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"message": "File changed on disk", "content": exc.disk_content, "mtime_ns": str(exc.disk_mtime_ns)},
        ) from None
    return {"name": name, "mtime_ns": str(mtime)}


@app.get("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/solution/{name}")
def get_solution(course_id: str, module_id: str, lesson_id: str, name: str) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    try:
        return {"name": name, "content": files.solution_file(lesson, name)}
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{name} is not part of this lesson") from None


class ResetBody(BaseModel):
    name: str | None = None
    keep_mine: bool = False  # True: just dismiss the "starter changed" notice


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/reset")
def reset(course_id: str, module_id: str, lesson_id: str, body: ResetBody) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    try:
        if body.keep_mine:
            files.accept_starter(lesson)
        else:
            files.reset_files(lesson, body.name)
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown file") from None
    out = []
    for n in files.editable_files(lesson):
        content, mtime = files.read_file(lesson, n)
        out.append({"name": n, "content": content, "mtime_ns": str(mtime)})
    return {"files": out}


@app.get("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/starter/{name}")
def get_starter(course_id: str, module_id: str, lesson_id: str, name: str) -> dict:
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    try:
        return {"name": name, "content": files.starter_file(lesson, name)}
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown file") from None


@app.get("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/watch", response_class=EventSourceResponse)
async def watch(course_id: str, module_id: str, lesson_id: str, request: Request) -> AsyncIterable[ServerSentEvent]:
    """Tells the editor when a file changes on disk (for example, saved from your IDE)."""
    _, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    seen = files.mtimes(lesson)
    while not await request.is_disconnected():
        await asyncio.sleep(0.5)
        now = files.mtimes(lesson)
        for name, mtime in now.items():
            if mtime != seen.get(name):
                content, mtime = files.read_file(lesson, name)
                yield ServerSentEvent(event="file", data={"name": name, "content": content, "mtime_ns": str(mtime)})
        seen = now


# --- tests


class RunBody(BaseModel):
    kind: str = "core"


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/run")
async def run(course_id: str, module_id: str, lesson_id: str, body: RunBody) -> dict:
    course, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    if body.kind not in ("core", "stretch"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "kind must be core or stretch")
    result = await runner.run_tests(course, lesson.exercise_dir, runner.lesson_tests(lesson, body.kind))
    lp = None
    if result.ok and body.kind == "core":
        lp = progress.mark_step(lesson, "fix", passed=result.passed)
    elif result.ok and body.kind == "stretch":

        def apply(p):
            p.stretch_done = True

        lp = progress.update_lesson(lesson, apply)
    return {**result.model_dump(), "progress": lp.model_dump() if lp else None}


@app.post("/api/courses/{course_id}/lessons/{module_id}/{lesson_id}/prove")
async def run_prove(course_id: str, module_id: str, lesson_id: str) -> dict:
    course, lesson = get_lesson_or_404(course_id, module_id, lesson_id)
    result = await runner.prove(course, lesson, lesson.exercise_dir / lesson.meta.prove_file)
    lp = progress.mark_step(lesson, "prove") if result.ok else None
    return {**result.model_dump(), "progress": lp.model_dump() if lp else None}


# ---------------------------------------------------------------- module quiz + design question


@app.get("/api/courses/{course_id}/modules/{module_id}/quiz")
def get_quiz(course_id: str, module_id: str) -> dict:
    course = get_course_or_404(course_id)
    module = course.module(module_id)
    if module is None or not module.has_quiz:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No quiz for this module")
    qf = load_toml(module.dir / "quiz.toml", QuizFile)
    saved = progress.course(progress.load(), course_id).quizzes.get(module_id)
    return {
        "module": {"id": module.meta.id, "title": module.meta.title, "icon": module.meta.icon},
        "questions": [{"prompt": html(q.prompt), "options": [html(o) for o in q.options]} for q in qf.questions],
        "saved": saved.model_dump() if saved else None,
    }


@app.post("/api/courses/{course_id}/modules/{module_id}/quiz")
def submit_quiz(course_id: str, module_id: str, body: PredictBody) -> dict:
    course = get_course_or_404(course_id)
    module = course.module(module_id)
    if module is None or not module.has_quiz:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No quiz for this module")
    qf = load_toml(module.dir / "quiz.toml", QuizFile)
    if len(body.answers) != len(qf.questions):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Answer every question")
    results = [
        {"correct": a == q.answer, "answer": q.answer, "explain": html(q.explain)}
        for a, q in zip(body.answers, qf.questions, strict=True)
    ]
    score = sum(r["correct"] for r in results)
    progress.save_quiz(
        course_id,
        module_id,
        QuizProgress(score=score, total=len(results), answers=[a if a is not None else -1 for a in body.answers]),
    )
    return {"results": results, "score": score, "total": len(results)}


@app.get("/api/courses/{course_id}/modules/{module_id}/design")
def get_design(course_id: str, module_id: str) -> dict:
    course = get_course_or_404(course_id)
    module = course.module(module_id)
    if module is None or not module.has_design:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No design question for this module")
    text = (module.dir / "design.md").read_text(encoding="utf-8")
    question, _, answer = text.partition("\n## Model answer")
    progress.mark_design_viewed(course_id, module_id)
    return {
        "module": {"id": module.meta.id, "title": module.meta.title, "icon": module.meta.icon},
        "question": html(question),
        "answer": html("## Model answer" + answer) if answer else None,
    }


# ---------------------------------------------------------------- static UI


if VENDOR.is_dir():  # optional offline copy of Monaco (make offline)
    app.mount("/vendor", StaticFiles(directory=VENDOR), name="vendor")
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-cache"})
