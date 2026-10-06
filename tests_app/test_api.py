import shutil

import pytest
from fastapi.testclient import TestClient

from app import discovery, files, progress
from app.models import ReviewComment, ReviewFile
from app.review import grade
from app.server import app

COURSE = "backend-for-ai-engineers"
LESSON = f"/api/courses/{COURSE}/lessons/api-fundamentals/methods-and-status-codes"


@pytest.fixture
def client():
    progress.reset()
    lesson = discovery.get_course(COURSE).find("api-fundamentals", "methods-and-status-codes")
    shutil.rmtree(lesson.exercise_dir, ignore_errors=True)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def lesson():
    return discovery.get_course(COURSE).find("api-fundamentals", "methods-and-status-codes")


def test_discovers_course_and_lesson(client):
    courses = client.get("/api/courses").json()
    assert [c["id"] for c in courses] == [COURSE]
    modules = courses[0]["modules"]
    assert modules[0]["id"] == "api-fundamentals"
    assert modules[0]["lessons"][0]["id"] == "methods-and-status-codes"
    assert [m["icon"] for m in modules] == ["onigiri", "ramen", "dango", "sushi", "taiyaki", "bento"]


def test_unknown_course_and_lesson_are_404(client):
    assert client.get("/api/courses/nope").status_code == 404
    assert client.get(f"/api/courses/{COURSE}/lessons/api-fundamentals/nope").status_code == 404


def test_lesson_payload_hides_answers(client):
    data = client.get(LESSON).json()
    assert data["lesson"]["steps"] == ["concept", "predict", "review", "fix", "prove", "defend"]
    assert "answer" not in data["predict"]["questions"][0]
    assert "issues" not in data["review"] and data["review"]["issue_count"] == 7
    assert {f["name"] for f in data["files"]} == {"main.py", "test_prove.py"}
    assert isinstance(data["files"][0]["mtime_ns"], str), "mtimes must be strings (JS numbers lose precision)"


def test_exercise_created_from_starter_and_never_overwritten(client, lesson):
    client.get(LESSON)
    main = lesson.exercise_dir / "main.py"
    assert main.read_text() == (lesson.dir / "starter" / "main.py").read_text()
    main.write_text("# mine\n")
    client.get(LESSON)
    assert main.read_text() == "# mine\n"


def test_starter_changed_notice(client, lesson):
    client.get(LESSON)
    starter = lesson.dir / "starter" / "main.py"
    original = starter.read_text()
    try:
        starter.write_text(original + "\n# updated\n")
        assert client.get(LESSON).json()["starter_changed"] is True
        client.post(LESSON + "/reset", json={"keep_mine": True})
        assert client.get(LESSON).json()["starter_changed"] is False
    finally:
        starter.write_text(original)


def test_save_detects_disk_conflict(client, lesson):
    f = next(x for x in client.get(LESSON).json()["files"] if x["name"] == "main.py")
    ok = client.put(LESSON + "/files/main.py", json={"content": "a = 1\n", "base_mtime_ns": f["mtime_ns"]})
    assert ok.status_code == 200
    (lesson.exercise_dir / "main.py").write_text("changed in IDE\n")  # someone else edits the file
    stale = client.put(LESSON + "/files/main.py", json={"content": "b = 2\n", "base_mtime_ns": ok.json()["mtime_ns"]})
    assert stale.status_code == 409
    assert stale.json()["detail"]["content"] == "changed in IDE\n"
    forced = client.put(LESSON + "/files/main.py", json={"content": "b = 2\n", "base_mtime_ns": None})
    assert forced.status_code == 200


def test_only_declared_files_are_reachable(client):
    client.get(LESSON)
    assert client.get(LESSON + "/files/..%2F..%2Fprogress.json").status_code == 404
    assert client.put(LESSON + "/files/evil.py", json={"content": "x"}).status_code == 404


def test_run_tests_and_fix_step(client, lesson):
    client.get(LESSON)
    red = client.post(LESSON + "/run", json={"kind": "core"}).json()
    assert red["ok"] is False and red["failed"] > 0
    failing = [c for c in red["checks"] if c["outcome"] != "passed"]
    assert all(c["message"] and "Traceback" not in c["message"] for c in failing), "messages must be readable"
    solution = (lesson.solution_dir / "main.py").read_text()
    client.put(LESSON + "/files/main.py", json={"content": solution})
    green = client.post(LESSON + "/run", json={"kind": "core"}).json()
    assert green["ok"] is True, green
    assert green["progress"]["steps"]["fix"]["done"] is True


def test_syntax_error_is_reported_plainly(client):
    client.get(LESSON)
    client.put(LESSON + "/files/main.py", json={"content": "def broken(:\n"})
    run = client.post(LESSON + "/run", json={"kind": "core"}).json()
    assert run["ok"] is False
    assert "failed to load" in run["checks"][0]["message"] and "SyntaxError" in run["checks"][0]["message"]


def test_prove(client, lesson):
    client.get(LESSON)
    weak = client.post(LESSON + "/prove").json()
    assert weak["ok"] is False and "passed on the buggy PR" in weak["message"]
    ref = (lesson.dir / "tests" / "prove_reference.py").read_text()
    client.put(LESSON + "/files/test_prove.py", json={"content": ref})
    strong = client.post(LESSON + "/prove").json()
    assert strong["ok"] is True
    too_strict = ref.replace("== 404", "== 418")
    client.put(LESSON + "/files/test_prove.py", json={"content": too_strict})
    assert "fails on the correct solution" in client.post(LESSON + "/prove").json()["message"]


def test_predict_scoring(client):
    r = client.post(LESSON + "/predict", json={"answers": [1, 2, 0]}).json()
    assert r["score"] == 2 and r["total"] == 3
    assert [x["correct"] for x in r["results"]] == [True, True, False]
    assert client.post(LESSON + "/predict", json={"answers": [1]}).status_code == 422


def test_review_grading_rules(lesson):
    rubric = discovery.load_toml(lesson.dir / "review.toml", ReviewFile)
    comments = [
        ReviewComment(line=36, severity="blocker", category="correctness", text="200 null"),
        ReviewComment(line=45, severity="blocker", category="correctness", text="GET deletes"),
        ReviewComment(line=12, severity="nit", category="style", text="false alarm"),
    ]
    result = grade(rubric, comments)
    by_id = {r.issue.id: r for r in result.issues}
    assert by_id["missing-200-null"].found and by_id["missing-200-null"].category_match
    assert by_id["get-deletes"].found and not by_id["get-deletes"].category_match  # it's security
    assert not by_id["delete-keyerror"].found
    assert [c.line for c in result.false_alarms] == [12]
    # One comment can't count for two neighbouring issues (lines 25-26 and 28-29).
    one = grade(rubric, [ReviewComment(line=27, severity="major", category="correctness")])
    assert sum(r.found for r in one.issues) == 1


def test_lesson_completes_when_every_step_is_done(client, lesson):
    for step in ("concept",):
        client.post(LESSON + f"/steps/{step}/done")
    assert client.post(LESSON + "/steps/fix/done").status_code == 409  # fix is earned by passing tests
    for step in ("predict", "review", "fix", "prove"):
        progress.mark_step(lesson, step)
    lp = client.post(LESSON + "/steps/defend/done").json()
    assert lp["completed"] is True
    summary = client.get(f"/api/courses/{COURSE}").json()
    assert summary["lessons_done"] == 1
    assert progress.load().courses[COURSE].lessons[lesson.key].completed  # persisted to disk


def test_corrupt_progress_file_does_not_break_the_app(client):
    progress.PROGRESS_FILE.write_text("{not json")
    assert client.get("/api/courses").status_code == 200


def test_watch_endpoint_is_sse(client):
    # The real stream waits for file changes; checking the route exists and is SSE is enough here.
    route = next(r for r in app.routes if getattr(r, "path", "").endswith("/watch"))
    assert route.response_class.__name__ == "EventSourceResponse"


def test_ui_is_served(client):
    r = client.get("/")
    assert r.status_code == 200 and "bento-academy" in r.text
    assert client.get("/static/app.js").status_code == 200


def test_concept_is_split_into_slides_with_story_first(client):
    data = client.get(LESSON).json()
    titles = [s["title"] for s in data["slides"]]
    assert titles[0] == "The story" and "Worked example" in titles
    assert len(data["check"]) == 3 and "answer" not in data["check"][0]


def test_lesson_check_marks_concept_done(client):
    r = client.post(LESSON + "/check", json={"answers": [1, 2, 0]}).json()
    assert r["score"] == 3
    assert r["progress"]["steps"]["concept"]["done"] is True


def test_module_intro_and_its_check(client):
    base = f"/api/courses/{COURSE}/modules/api-fundamentals/intro"
    intro = client.get(base).json()
    assert intro["slides"][0]["title"] == "The story"
    assert len(intro["questions"]) == 4 and intro["saved"] is None
    assert intro["first_lesson"]["lesson"] == "methods-and-status-codes"
    r = client.post(base, json={"answers": [1, 2, 0, 2]}).json()
    assert r["score"] == 4
    summary = client.get(f"/api/courses/{COURSE}").json()
    assert summary["modules"][0]["intro_done"] is True
    assert client.get(f"/api/courses/{COURSE}/modules/streaming/intro").status_code == 404
