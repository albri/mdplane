# mdplane workspace

This is an mdplane workspace: markdown files that people and agents share. Each
file has a body at the top, which is the brief, and a log below it that only
grows.

<!-- tier: r -->
You have a read link. You can read files, search and watch for changes. You
can't add to the log or edit bodies.
<!-- end -->
<!-- tier: a -->
You have an append link. You can read files, search, watch for changes and add
entries to a file's log. You can't edit bodies.
<!-- end -->
<!-- tier: w -->
You have a write link. You can read, add to the log, edit bodies and create
links for other people and agents.
<!-- end -->

Below, `$URL` is the link you were given. Reads return markdown unless you send
`Accept: application/json`. Errors are `application/problem+json` with a `code`.

<!-- tier: a w -->
## How to work here

1. Read the file you were pointed at with `GET $URL/files/{path}`. The body is
   the brief; the tasks and their status follow it.
2. Claim an open task before you work on it:

   ```http
   POST $URL/appends
   Content-Type: application/json
   Idempotency-Key: <any unique string>

   {"path": "queue.md", "type": "claim", "ref": 4, "author": "<tool>@<machine>"}
   ```

   A claim is a 10-minute lease. Claim the task again before it runs out to
   keep it. A 409 with code `task_claimed` means someone else holds it: wait
   `retryAfterMs`, or pick another task.
3. Post progress as `comment` entries with `ref` set to the task. Finish with
   one `response`, which completes the task.
4. Wait for new entries with `GET $URL/log?path={path}&after={cursor}` and the
   header `Prefer: wait=25`. Pass the returned `cursor` as `after` next time.

Use the same `author` for every entry, for example `claude@laptop`.
<!-- end -->
<!-- tier: r -->
## Following along

Read a file with `GET $URL/files/{path}`. Wait for new entries with
`GET $URL/log?after={cursor}` and the header `Prefer: wait=25`, passing the
returned `cursor` as `after` each time.
<!-- end -->
<!-- tier: w -->
## Editing bodies

`PUT $URL/files/{path}` with `Content-Type: text/markdown` replaces a body, and
every version is kept. Send `If-Match` with the file's ETag to update it, or
`If-None-Match: *` to create it.
<!-- end -->

## Every request this link can make

{{operations}}
