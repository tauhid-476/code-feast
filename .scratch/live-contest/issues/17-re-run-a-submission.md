# 17: Re-run a submission

**What to build:** While reading a Participant's Submission, the Organizer can run that submitted code against the Problem's Sample Test Cases and see the same result shape a Participant saw. It is a reading aid, not a verdict: nothing about it is stored, scored, or compared against other Participants.

**Blocked by:** 06: Run pipeline and the Test this problem panel; 16: Review dashboard and shortlist

**Status:** ready-for-agent

- [ ] Each Problem tab in the review detail offers a Run action that executes that Participant's submitted code for that Problem.
- [ ] The re-run uses the Problem's real Harness and returns the same response shape as a Participant Run.
- [ ] The result shows per-case pass/fail with actual against expected, plus compile output and stderr.
- [ ] A re-run never modifies the Submission, the Participant's drafts, their strikes, or their status.
- [ ] Re-running works for deadline lockouts and eliminations, not only for Participants who submitted.
- [ ] A re-run for a language the Participant did not use is not offered.
- [ ] A busy runner returns the busy message rather than breaking the review screen.
- [ ] Nothing about a re-run appears anywhere the Organizer announces a result from; the surface states plainly that it produces no verdict.
