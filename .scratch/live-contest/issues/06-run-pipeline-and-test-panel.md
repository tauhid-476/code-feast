# 06: Run pipeline and the Test this problem panel

**What to build:** An Organizer can paste a reference solution for a Problem in a given language and run it against that Problem's two Sample Test Cases through the real runner and the real Harness, seeing exactly what a Participant would see. This exists because a broken Harness fails every Participant at once, and it is the only rehearsal available before the Event goes live.

**Blocked by:** 04: Per-language starter code and harness; 05: Warm sandbox pool

**Status:** ready-for-agent

- [ ] Each Problem, per language, has a "Test this problem" panel that accepts a reference solution and runs it against that Problem's two Sample Test Cases.
- [ ] The Harness is appended server-side at run time; the Organizer pastes only their solution, never the Harness.
- [ ] The response carries compile error, timeout flag, sandbox error, and per-case index, input, expected, actual, stderr, exit code, duration, and pass.
- [ ] The Organizer's test panel, a Participant's Run, and a later re-run all receive this identical response shape.
- [ ] Limits are Python/C++ 3s and 256MB per case, Java 6s and 512MB, compile 15s, and stdout truncated at 64KB.
- [ ] Input is delivered on stdin and expected output is compared after trimming trailing whitespace on both sides.
- [ ] Both Sample Test Cases always run, even when the first one fails.
- [ ] A compile error is reported once, with the remaining cases absent rather than fabricated.
- [ ] A Harness that fails to call the signed function shows up in this panel as a failing case, not as a crash of the panel.
