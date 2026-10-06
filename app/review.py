"""Grades your PR review against the issues planted in review.toml."""

from __future__ import annotations

from .models import IssueResult, ReviewComment, ReviewFile, ReviewResult

LINE_SLACK = 1  # a comment one line off still counts
_SEVERITY_ORDER = {"blocker": 0, "major": 1, "nit": 2}


def _near(comment: ReviewComment, lines: tuple[int, int]) -> bool:
    return lines[0] - LINE_SLACK <= comment.line <= lines[1] + LINE_SLACK


def grade(rubric: ReviewFile, comments: list[ReviewComment]) -> ReviewResult:
    """Match comments to planted issues. One comment counts for at most one issue,
    so two problems on neighbouring lines need two comments."""
    used: set[int] = set()
    matched: dict[str, IssueResult] = {}
    # Most severe and most precisely located issues pick their comment first.
    ordered = sorted(rubric.issues, key=lambda i: (_SEVERITY_ORDER[i.severity], i.lines[1] - i.lines[0]))
    for issue in ordered:
        hits = [(i, c) for i, c in enumerate(comments) if i not in used and _near(c, issue.lines)]
        hits.sort(key=lambda ic: (ic[1].category != issue.category, abs(ic[1].line - issue.lines[0])))
        if hits:
            i, c = hits[0]
            used.add(i)
            matched[issue.id] = IssueResult(issue=issue, found=True, category_match=c.category == issue.category, your_comment=c)
        else:
            matched[issue.id] = IssueResult(issue=issue, found=False)
    results = [matched[i.id] for i in rubric.issues]
    # Leftover comments near a planted issue are duplicates, not false alarms.
    false_alarms = [
        c for i, c in enumerate(comments) if i not in used and not any(_near(c, iss.lines) for iss in rubric.issues)
    ]
    total = {"blocker": 0, "major": 0, "nit": 0}
    found = {"blocker": 0, "major": 0, "nit": 0}
    for r in results:
        total[r.issue.severity] += 1
        found[r.issue.severity] += r.found
    return ReviewResult(
        issues=results,
        false_alarms=false_alarms,
        found=found,
        total=total,
        model_review=rubric.model_review,
        teaching_comment=rubric.teaching_comment,
    )
