"""Bonus: write ONE test that fails on the PR and passes on your fix.

The bug: a second prompt named "summarize" is accepted.
"""


def test_duplicate_name_is_409(client):
    """A second prompt named 'summarize' is refused with 409"""
    # TODO: post {"name": "summarize", "template": "..."} and assert r.status_code == 409
    pass
