# 10: Run from the contest

**What to build:** A Participant runs their current code against both Sample Test Cases and gets per-case feedback: pass or fail, actual against expected, compile output, stderr, and timing. A Run is feedback only and is never recorded as a Submission. Runs are rate limited so a synchronized room cannot melt the pool, and when the pool cannot serve a Run the Participant is told plainly while the clock keeps running.

**Blocked by:** 06: Run pipeline and the Test this problem panel; 09: Contest view: fullscreen gate, editor, autosave

**Status:** resolved

- [x] Run executes the Participant's current editor content against both Sample Test Cases through the real Harness.
- [x] Results show per-case pass/fail with actual against expected, plus compile output, stderr, exit code, and duration.
- [x] A Run is never recorded as a Submission and never locks the Participant.
- [x] A Participant has at most one Run in flight and must wait at least two seconds between Runs.
- [x] A second Run request while one is in flight is refused rather than queued.
- [x] When no sandbox can be claimed within 20 seconds the Run returns a 503 saying the runner is busy, and the Deadline is unaffected.
- [x] A Run from a Participant who is already locked is refused.
- [x] The Harness is never echoed back in the Run response.

## Notes

Implemented on `ticket/10-run-from-contest`.

### Files

- `src/lib/contest/run.ts` — `runFromContest(context, { problemId, language,
  code }, { provider?, now?, claimTimeoutMs? })`: the participant gate
  (`not_joined` 403, `contest_locked` 409, `contest_not_open` 409,
  `problem_not_found` 404), the rate-limit claim, then the same
  `runAgainstSamples` the organizer's test panel uses. No second Run
  implementation and no second result shape.
- `src/app/api/run/route.ts` — POST `/api/run`. `getViewer()`, role check, zod
  body (`joinCode`, `problemId`, `language`, `code`), participant loader, domain
  call. Success answers `{ result }`; a `DomainError` answers `{ error }` with
  its status. `after(scheduleReplenish())` runs on every outcome, because any
  Run request that finds the pool short is a replenish trigger (SPEC §7).
- `src/components/use-contest-run.ts` — the Run request in the workspace: one
  in-flight Run, a 60s client timeout, the server's message on refusal.
- `src/components/contest-run-outcome.tsx` — the Result area. Delegates to
  ticket 06's `RunResultView`, so a participant sees exactly the organizer's
  Test-panel shape: pass/fail, actual vs expected, compile output, stderr, exit
  code, ms.
- `src/components/contest-workspace.tsx` — Run is live; the verdict sits under
  the editor; Submit stays disabled for ticket 11.
- `src/lib/runner/run.ts` — `RunOptions.claimTimeoutMs`, passed to
  `withClaimedSandbox`. The default is still `CLAIM_TIMEOUT_MS` (20s); the
  option exists so a test exercises the bound instead of sleeping 20s.
- `tests/ticket-10-run-from-contest.test.ts` — 13 tests.

### Where the rate limit lives, and why

`participants` gained two nullable columns (`drizzle/0001_black_black_bird.sql`):
`run_in_flight_at` and `last_run_at`. The app runs on several serverless
instances, so an in-memory flag would let each instance hold one Run for the same
participant. One conditional `UPDATE ... RETURNING` both checks and takes the
slot, so two concurrent requests cannot both win; the loser reads the row only to
name the refusal (`run_in_flight` or `run_too_soon`, both 429).

- The two seconds are measured from the **completion** of the previous Run, which
  is the reading of "between Runs". While a Run is open, the in-flight rule
  covers the same ground.
- `now` is frozen for the whole call when a test passes it, so claim and release
  see one instant; the app reads the clock twice.
- Release is matched on the claimed timestamp, so a late release cannot clear a
  claim another request has already taken.
- A claim older than `RUN_CLAIM_STALE_MS` (120s) is reclaimable. No real Run can
  reach that: 20s claim + 15s compile + 2 × 6s cases. Without it, a deploy or a
  killed function would close Runs for that participant for the rest of the
  event.
- A refused Run never touches the pool: the claim precedes the sandbox claim.

### The verdict goes stale with the code

The result is discarded on the next keystroke, Problem change, or language
change, matching ticket 06's rule. A Run that lands after the buffer moved is
also dropped (the hook counts buffer versions), so a verdict is never shown
beside the wrong code.

### What a Run does not do

Nothing is written except the slot: no `submissions` row, no strike, no change to
`deadline_at` or the participant's status. A Run in flight when the deadline
passes finishes and returns its result; the **next** Run is refused because the
loader has locked the participant by then. Nothing kills an in-flight Run, so the
clock is the only thing that stops the participant, not the runner.

### Deployment

This ticket adds migration `0001`. Run `npm run db:migrate` against the
production branch **before** deploying the code: the new code writes
`participants.run_in_flight_at`, so the columns must exist first. The columns are
nullable, so the previous deployment keeps working if the migration lands first.
