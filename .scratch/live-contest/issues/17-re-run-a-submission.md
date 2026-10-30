# 17: Re-run a submission

**What to build:** While reading a Participant's Submission, the Organizer can run that submitted code against the Problem's Sample Test Cases and see the same result shape a Participant saw. It is a reading aid, not a verdict: nothing about it is stored, scored, or compared against other Participants.

**Blocked by:** 06: Run pipeline and the Test this problem panel; 16: Review dashboard and shortlist

**Status:** resolved

- [x] Each Problem tab in the review detail offers a Run action that executes that Participant's submitted code for that Problem.
- [x] The re-run uses the Problem's real Harness and returns the same response shape as a Participant Run.
- [x] The result shows per-case pass/fail with actual against expected, plus compile output and stderr.
- [x] A re-run never modifies the Submission, the Participant's drafts, their strikes, or their status.
- [x] Re-running works for deadline lockouts and eliminations, not only for Participants who submitted.
- [x] A re-run for a language the Participant did not use is not offered.
- [x] A busy runner returns the busy message rather than breaking the review screen.
- [x] Nothing about a re-run appears anywhere the Organizer announces a result from; the surface states plainly that it produces no verdict.

## Notes

- Implemented `rerunSubmission` in `src/lib/review/rerun.ts`:
  - Enforces organizer role authorization and event ownership (`assertOrganizer`, `getOrganizerEvent`).
  - Reconciles any passed event deadline automatically via `lockAtDeadline`.
  - Ensures participant is locked out (`submitted`, `deadline`, or `eliminated`) and belongs to the event.
  - Verifies problem exists in the event and retrieves the exact submitted code and language snapshot for that problem.
  - Executes the code with the problem's real starter harness and sample test cases via `runAgainstSamples`.
  - Guaranteed pure read-only behavior: performs zero mutations on participants, submissions, drafts, or violations.
- Implemented `rerunSubmissionAction` server action in `src/app/admin/events/[id]/review/actions.ts`:
  - Protects invocation via `requireOrganizer()`.
  - Dispatches background pool replenishment using `after(scheduleReplenish())`.
  - Safely catches domain errors and runner busy conditions via `actionError`.
- Updated `ParticipantReviewPanel` in `src/components/review-dashboard.tsx`:
  - Offers a "Run submitted code" action on each problem tab containing submitted code with loading spinner and `:active:scale-[0.98]` feedback.
  - Displays a dedicated "Reading aid" banner explaining: `"Reading aid — runs code against sample test cases and produces no verdict or score."`
  - Renders execution results using `RunResultView` with per-case pass/fail, expected vs actual outputs, execution time, compile errors, and stderr.
  - Displays inline warning alert for runner busy / domain errors without breaking the review screen.
  - Suppresses run actions for problems with no submitted code, displaying `"No code submitted for this problem."`
- Authored test suite `tests/ticket-17-re-run-a-submission.test.ts` (16 tests) covering domain execution, compile errors, runtime mismatches, lockout reasons (`submitted`, `deadline`, `eliminated`), in-progress participant refusals, cross-event isolation, non-mutation guarantees, runner timeout/busy handling, and UI rendering.
- Passed full verification quality gates: `npx next typegen`, `npm run typecheck`, `npm run lint`, `npm test` (all suites passing), and `npm run build`.
