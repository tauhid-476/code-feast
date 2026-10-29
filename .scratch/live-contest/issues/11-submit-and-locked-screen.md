# 11: Submit and the locked screen

**What to build:** Submitting is the Participant's one irreversible action: a confirmation warns that it ends their contest, and confirming freezes a Submission containing the code of every Problem at that moment. The same Submission is produced without their involvement when the Deadline passes, using the last autosaved code. Either way they land on a terminal screen showing why they are locked and how long they worked, and the code is no longer viewable or editable.

**Blocked by:** 09: Contest view: fullscreen gate, editor, autosave

**Status:** resolved

- [x] Submit asks for confirmation with wording that makes clear it ends the contest and cannot be undone.
- [x] Confirming locks the Participant out with reason `submitted`.
- [x] Lockout records exactly one Submission per Participant, holding the code of every Problem at that moment, the language used per Problem, the reason, and the time.
- [x] The locked screen is terminal: it shows the reason and the elapsed time, and the code is neither viewable nor editable.
- [x] A Deadline lockout produces the same recorded Submission from the last autosaved code, with reason `deadline` and a locked-out time equal to the Deadline.
- [x] A Participant who closes the tab before the Deadline and returns afterwards is locked with the code that was autosaved, not an empty Submission.
- [x] Submitting twice is impossible; a second Submit is refused and does not create a second Submission.
- [x] Returning to the contest route after lockout shows the locked screen instead of the editor.
- [x] Cancelling the confirmation leaves the Participant in the contest with nothing recorded.

## Notes

Implemented on `ticket/11-submit-and-locked-screen`. Tests are in
`tests/ticket-11-submit-and-locked-screen.test.ts` (13 cases). No migration:
the schema already had `submissions` and `submission_snippets`.

### One lockout write, one Submission

`src/lib/participants/lockout.ts` now owns both halves:

- `finalizeLockout(executor, participantId, { reason, lockedAt })` runs the
  conditional `UPDATE ... WHERE status <> 'locked_out'` and returns null when
  someone else won. That null is the double-submit guard: a stale tab, a double
  click, or a retried request never reaches the Submission write.
- `recordSubmission` upserts the one `submissions` row (unique on
  `participant_id`, so a reinstated-then-locked-again participant keeps one row
  with the new reason and time) and **replaces** its snippets. Snippets come
  from `drafts` with `DISTINCT ON (problem_id) ... ORDER BY problem_id,
  updated_at DESC, language` — the code the participant last had open, in the
  language they last used for it. A Problem they never typed in has no draft,
  so nothing is invented for it; the Harness only lives in
  `problem_starters` and is never copied into a draft, so it cannot reach a
  Submission.
- `lockAtDeadline` keeps its bulk/event scope and now writes the same
  Submission per participant it locks. The live health strip and End now go
  through it, so every way a participant gets locked at the Deadline produces
  the same record. `locked_at` is the Deadline, never the moment the server
  noticed.

`reconcileDeadline` in `src/lib/participants/queries.ts` now calls
`finalizeLockout` inside a transaction, so a read that discovers the Deadline
commits the lock and the frozen code together. Concurrent reads are safe: the
loser's conditional update returns no row.

### Submit

`src/lib/contest/submit.ts`: `submitContest(context, { now })` gates on
`not_joined` 403, `contest_locked` 409, and `contest_not_open` 409, then locks
with reason `submitted` at `now`. A Submit that lands on or after the Deadline is
recorded as `deadline` at the Deadline instead — the clock wins over a late
click, matching every other read.

`src/app/e/[code]/actions.ts:submitContestAction` resolves the viewer, clears
the fullscreen gate cookie, and returns `{ href: "/e/<CODE>/locked" }`. A
participant who is already locked is routed to the terminal screen rather than
shown an error: the refusal is that nothing new is written.

### The client

`SubmitContest` (`src/components/submit-contest.tsx`) is the header button and
its `AlertDialog`; the wording lives in `src/lib/contest/copy.ts` so it can be
tested without a browser. Before the write it calls the autosave hook's new
`flushAll()`, which cancels pending debounces, joins any request already in
flight, and runs a second pass for keystrokes typed during the first. If the
work still is not on the server, Submit refuses with
`Your latest changes are not saved yet` rather than freezing a snapshot that is
missing the participant's last lines. **Keep working** is an
`AlertDialogCancel` and never calls the action.

### The terminal screen

`LockedScreen` (`src/components/locked-screen.tsx`) shows the reason badge
(`Submitted` / `Deadline` / `Eliminated`), the participant, `Elapsed` computed
from `joined_at` to `locked_at`, and `Your code is frozen. It can no longer be
viewed or changed.` The page hands it no code and reads no drafts; a source test
keeps `listDrafts` and `ContestEditor` out of `locked/page.tsx`. The sign-out
control is passed in as `action` so the screen still renders in a test without
an app router.

### Deployment

`docs/verify-deploy.md` step 6 now says what a working Submit, a cancelled
confirmation, and a Deadline lockout look like, and the failure table names the
two new symptoms. Remember migration `0001` from ticket 10 has not been applied
to the production branch yet; apply it before the next deploy.
