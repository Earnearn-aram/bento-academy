"""Reads research/requests and research/findings (see research/README.md).

Both are Markdown files with a small YAML-style frontmatter. Only the simple shapes
we use are parsed (`key: value`, and `key:` followed by `  - item` lines), so no YAML
library is needed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from . import discovery

STATUSES = ("requested", "answered", "reviewed", "applied")
_ID = re.compile(r"^R\d+$")


def research_dir() -> Path:
    return discovery.ROOT / "research"


def frontmatter(text: str) -> dict[str, str | list[str]]:
    """Top-level keys of a `---` block. Nested mappings (like sources' url/date) count as list items."""
    if not text.startswith("---\n"):
        raise ValueError("no frontmatter (the file must start with ---)")
    if "\n---" not in text[3:]:
        raise ValueError("frontmatter is not closed with ---")
    block = text[4:].split("\n---", 1)[0]
    data: dict[str, str | list[str]] = {}
    key = None
    for line in block.splitlines():
        if not line.strip():
            continue
        if line.startswith("  - "):
            if key is None:
                raise ValueError(f"list item before any key: {line!r}")
            if not isinstance(data[key], list):
                data[key] = []
            data[key].append(line[4:].strip())
        elif line.startswith(" "):
            continue  # extra fields of a list item, e.g. page_last_updated
        else:
            key, _, value = line.partition(":")
            key, value = key.strip(), value.strip()
            data[key] = [] if value in ("", "[]") else value.strip('"')
    return data


@dataclass
class Entry:
    id: str
    path: Path
    meta: dict = field(default_factory=dict)


def _load(folder: str) -> tuple[dict[str, Entry], list[str]]:
    entries: dict[str, Entry] = {}
    errors: list[str] = []
    for path in sorted((research_dir() / folder).glob("R*.md")):
        try:
            meta = frontmatter(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            errors.append(f"{folder}/{path.name}: {exc}")
            continue
        rid = meta.get("id")
        if not isinstance(rid, str) or not _ID.match(rid):
            errors.append(f"{folder}/{path.name}: missing or bad id (expected e.g. R6)")
            continue
        if not path.name.startswith(f"R{int(rid[1:]):02d}-"):
            errors.append(f"{folder}/{path.name}: file name should start with R{int(rid[1:]):02d}- to match id {rid}")
        if rid in entries:
            errors.append(f"{folder}/{path.name}: duplicate id {rid}")
        entries[rid] = Entry(rid, path, meta)
    return entries, errors


def findings() -> dict[str, Entry]:
    return _load("findings")[0]


def check(cited: dict[str, list[str]]) -> list[str]:
    """Problems in research/, plus lesson sources that cite a finding that doesn't exist.
    `cited` maps a research id to the lessons citing it."""
    root = research_dir()
    if not root.is_dir():
        return [f"research {rid} cited by {', '.join(who)}, but there is no research/ folder" for rid, who in cited.items()]
    requests, errors = _load("requests")
    found, more = _load("findings")
    errors += more
    for rid, req in requests.items():
        for key in ("title", "status", "asked_on"):
            if not req.meta.get(key):
                errors.append(f"requests/{req.path.name}: missing {key}")
        status = req.meta.get("status")
        if status and status not in STATUSES:
            errors.append(f"requests/{req.path.name}: status {status!r} is not one of {', '.join(STATUSES)}")
        if status in STATUSES[1:] and rid not in found:
            errors.append(f"requests/{req.path.name}: status is {status} but there is no finding for {rid}")
        if status == "applied" and not req.meta.get("used_by"):
            errors.append(f"requests/{req.path.name}: status is applied but used_by is empty")
    for rid, fnd in found.items():
        for key in ("title", "read_on", "sources"):
            if not fnd.meta.get(key):
                errors.append(f"findings/{fnd.path.name}: missing {key}")
        if rid not in requests:
            errors.append(f"findings/{fnd.path.name}: no matching request for {rid}")
    index = (root / "README.md").read_text(encoding="utf-8") if (root / "README.md").is_file() else ""
    for rid in requests:
        if not re.search(rf"^\| {rid} \|", index, re.M):
            errors.append(f"README.md: {rid} is missing from the index table")
    for rid, who in cited.items():
        if rid not in found:
            errors.append(f"{', '.join(who)} cite{'s' if len(who) == 1 else ''} research {rid}, which has no finding")
    return errors
