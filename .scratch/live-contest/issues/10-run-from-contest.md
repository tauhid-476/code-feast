# 10: Run from the contest

**What to build:** A Participant runs their current code against both Sample Test Cases and gets per-case feedback: pass or fail, actual against expected, compile output, stderr, and timing. A Run is feedback only and is never recorded as a Submission. Runs are rate limited so a synchronized room cannot melt the pool, and when the pool cannot serve a Run the Participant is told plainly while the clock keeps running.

**Blocked by:** 06: Run pipeline and the Test this problem panel; 09: Contest view: fullscreen gate, editor, autosave

**Status:** ready-for-agent

- [ ] Run executes the Participant's current editor content against both Sample Test Cases through the real Harness.
- [ ] Results show per-case pass/fail with actual against expected, plus compile output, stderr, exit code, and duration.
- [ ] A Run is never recorded as a Submission and never locks the Participant.
- [ ] A Participant has at most one Run in flight and must wait at least two seconds between Runs.
- [ ] A second Run request while one is in flight is refused rather than queued.
- [ ] When no sandbox can be claimed within 20 seconds the Run returns a 503 saying the runner is busy, and the Deadline is unaffected.
- [ ] A Run from a Participant who is already locked is refused.
- [ ] The Harness is never echoed back in the Run response.
