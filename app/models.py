"""Pydantic models for everything bento-academy reads or writes.

Content files (course.toml, meta.toml, ...) are validated against the *File
models, so a typo in a lesson fails with a clear error instead of a broken UI.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

StepName = Literal["concept", "predict", "review", "fix", "prove", "defend"]
Severity = Literal["blocker", "major", "nit"]
Category = Literal["correctness", "security", "scale", "reliability", "style"]
ALL_STEPS: tuple[StepName, ...] = ("concept", "predict", "review", "fix", "prove", "defend")


class ContentModel(BaseModel):
    """Base for content files: unknown keys are an error (catches typos)."""

    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------- content files


class Source(ContentModel):
    title: str
    url: str
    note: str | None = None


class CourseEnv(ContentModel):
    # Command run once by `make start` to install the course's dependencies.
    # Placeholders: {course_dir}
    setup: list[str] = []


class CourseTests(ContentModel):
    # Placeholders: {course_dir} {code_dir} {report} {tests} ({tests} expands to one arg per file)
    command: list[str]
    timeout_s: int = 90


class CourseSteps(ContentModel):
    default: list[StepName] = list(ALL_STEPS)


class CourseFile(ContentModel):
    """course.toml"""

    id: str
    title: str
    description: str = ""
    version: int = 1
    env: CourseEnv = CourseEnv()
    tests: CourseTests
    steps: CourseSteps = CourseSteps()


class ModuleFile(ContentModel):
    """module.toml"""

    id: str
    title: str
    short: str | None = None  # short label for tiles, e.g. "API basics"
    summary: str = ""
    icon: str = "onigiri"


class LessonFile(ContentModel):
    """meta.toml"""

    id: str
    title: str
    summary: str = ""
    minutes: int = 25
    version: int = 1
    steps: list[StepName] | None = None  # None = course default
    files: list[str] = ["main.py"]  # editable files; the first one is the entry module
    prove_file: str = "test_prove.py"
    sources: list[Source] = []


class PredictQuestion(ContentModel):
    prompt: str
    options: list[str] = Field(min_length=2)
    answer: int
    explain: str

    @model_validator(mode="after")
    def _answer_in_range(self) -> PredictQuestion:
        if not 0 <= self.answer < len(self.options):
            raise ValueError(f"answer {self.answer} is not a valid option index")
        return self


class PredictFile(ContentModel):
    """predict.toml"""

    intro: str = ""
    snippet: str = "predict/snippet.py"
    runnable: bool = True
    questions: list[PredictQuestion] = Field(min_length=1)


class ReviewIssue(ContentModel):
    id: str
    lines: tuple[int, int]
    severity: Severity
    category: Category
    title: str
    explanation: str


class ReviewFile(ContentModel):
    """review.toml"""

    title: str
    author: Literal["ai", "junior"]
    description: str
    file: str = "buggy/main.py"
    goal: str = "Find the blockers. Comments on correct code count as false alarms."
    issues: list[ReviewIssue] = Field(min_length=1)
    model_review: str
    teaching_comment: str | None = None  # how a Lead would phrase one comment for a junior


class InterviewQuestion(ContentModel):
    prompt: str
    answer: str


class InterviewFile(ContentModel):
    """interview.toml"""

    questions: list[InterviewQuestion] = Field(min_length=1, max_length=3)


class QuizQuestion(PredictQuestion):
    pass


class QuizFile(ContentModel):
    """quiz.toml (one per module)"""

    questions: list[QuizQuestion] = Field(min_length=1)


# ---------------------------------------------------------------- discovered tree


class Lesson(BaseModel):
    meta: LessonFile
    course_id: str
    module_id: str
    dir: Path
    solution_dir: Path
    exercise_dir: Path
    steps: list[StepName]

    @property
    def key(self) -> str:
        return f"{self.module_id}/{self.meta.id}"


class Module(BaseModel):
    meta: ModuleFile
    dir: Path
    lessons: list[Lesson]
    has_quiz: bool
    has_design: bool


class Course(BaseModel):
    meta: CourseFile
    dir: Path
    modules: list[Module]

    def lessons(self) -> list[Lesson]:
        return [lesson for module in self.modules for lesson in module.lessons]

    def find(self, module_id: str, lesson_id: str) -> Lesson | None:
        for lesson in self.lessons():
            if lesson.module_id == module_id and lesson.meta.id == lesson_id:
                return lesson
        return None

    def module(self, module_id: str) -> Module | None:
        return next((m for m in self.modules if m.meta.id == module_id), None)


# ---------------------------------------------------------------- test results
# The contract between any course's test runner and the app. A non-Python course
# only needs an adapter that writes this JSON to {report}.


class Check(BaseModel):
    id: str
    title: str
    outcome: Literal["passed", "failed", "error", "skipped"]
    message: str = ""
    details: str = ""
    best_practice: bool = False
    duration_s: float = 0.0

    @property
    def passed(self) -> bool:
        return self.outcome == "passed"


class TestRun(BaseModel):
    __test__ = False  # not a pytest test class

    ok: bool
    passed: int
    failed: int
    checks: list[Check]
    error: str | None = None  # the run itself broke (timeout, crash), not a check
    duration_s: float = 0.0


class ProveResult(BaseModel):
    ok: bool
    message: str
    against_buggy: TestRun
    against_solution: TestRun


# ---------------------------------------------------------------- review grading


class ReviewComment(BaseModel):
    line: int
    severity: Severity
    category: Category
    text: str = ""


class IssueResult(BaseModel):
    issue: ReviewIssue
    found: bool
    category_match: bool = False
    your_comment: ReviewComment | None = None


class ReviewResult(BaseModel):
    issues: list[IssueResult]
    false_alarms: list[ReviewComment]
    found: dict[str, int]  # by severity
    total: dict[str, int]
    model_review: str
    teaching_comment: str | None = None


# ---------------------------------------------------------------- progress


class StepState(BaseModel):
    done: bool = False
    data: dict = {}


class LessonProgress(BaseModel):
    steps: dict[str, StepState] = {}
    hints_shown: int = 0
    stretch_done: bool = False
    completed: bool = False
    completed_version: int | None = None


class QuizProgress(BaseModel):
    score: int
    total: int
    answers: list[int]


class CourseProgress(BaseModel):
    lessons: dict[str, LessonProgress] = {}
    quizzes: dict[str, QuizProgress] = {}
    designs_viewed: list[str] = []
    last_lesson: str | None = None
    last_step: str | None = None


class Progress(BaseModel):
    version: int = 1
    courses: dict[str, CourseProgress] = {}
