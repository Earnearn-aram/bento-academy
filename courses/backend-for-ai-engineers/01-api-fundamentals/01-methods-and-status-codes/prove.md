The PR's worst bug: asking for a prompt that doesn't exist returns `200` with `null`. A client treats that as success, and a cache may keep it.

Write **one test** in `test_prove.py` that **fails on the PR** and **passes on a correct fix**. Click **Run my test**: it runs your test against both versions.

This is how you back up a review comment: a failing test is evidence the author can run, not an opinion they can argue with.
