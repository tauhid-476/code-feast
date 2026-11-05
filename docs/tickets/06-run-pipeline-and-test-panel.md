# 06: Run pipeline and the Test this problem panel

**What to build:** An Organizer can paste a reference solution for a Problem in a given language and run it against that Problem's two Sample Test Cases through the real runner and the real Harness, seeing exactly what a Participant would see. This exists because a broken Harness fails every Participant at once, and it is the only rehearsal available before the Event goes live.

**Blocked by:** 04: Per-language starter code and harness; 05: Warm sandbox pool

**Status:** resolved

- [x] Each Problem, per language, has a "Test this problem" panel that accepts a reference solution and runs it against that Problem's two Sample Test Cases.
- [x] The Harness is appended server-side at run time; the Organizer pastes only their solution, never the Harness.
- [x] The response carries compile error, timeout flag, sandbox error, and per-case index, input, expected, actual, stderr, exit code, duration, and pass.
- [x] The Organizer's test panel, a Participant's Run, and a later re-run all receive this identical response shape.
- [x] Limits are Python/C++ 3s and 256MB per case, Java 6s and 512MB, compile 15s, and stdout truncated at 64KB.
- [x] Input is delivered on stdin and expected output is compared after trimming trailing whitespace on both sides.
- [x] Both Sample Test Cases always run, even when the first one fails.
- [x] A compile error is reported once, with the remaining cases absent rather than fabricated.
- [x] A Harness that fails to call the signed function shows up in this panel as a failing case, not as a crash of the panel.

## Notes

### Files

- `src/lib/runner/run.ts` — `runAgainstSamples(input, { provider?, now? })`:
  the only Run implementation. Assembles the file through
  `assembleRunProgram`, claims with `withClaimedSandbox`, runs the cases, and
  returns the SPEC §7 shape.
- `src/lib/problems/test.ts` — `testProblem(actor, { eventId, problemId,
  language, code }, options)`: the organizer's ownership gate in front of the
  same pipeline. Non-organizers get 403 `not_organizer`; another organizer's
  problem (or a problem in a different event) gets 404 `problem_not_found`.
  Testing is allowed in `draft`, `live`, and `ended`, because it is read-only.
- `src/app/admin/events/[id]/actions.ts` — `testProblemAction` (Server Action):
  `requireOrganizer()`, then the domain call. It also calls
  `after(scheduleReplenish())`, since a Run is a request that can notice the
  pool is short.
- `src/components/test-problem-panel.tsx` — `TestProblemPanel`: one tab per
  language, one reference-solution textarea per language, Run button, per-run
  error banner, and the last result. The old result is discarded as soon as the
  code changes, so a stale verdict is never shown beside new code.
- `src/components/test-problem-dialog.tsx` — `TestProblemDialog`: the per-Problem
  "Test" row button and its dialog; wires the Server Action into the panel.
- `src/components/run-result.tsx` — `RunResultView`: the single renderer for a
  Run result, reused by tickets 10 and 17. Compile error, timeout banner,
  sandbox error, and per case pass/fail, input, expected, actual, stderr, exit
  code, and ms.
- `src/components/problem-set.tsx` — a "Test" button on every Problem row, in
  every event status.
- `tests/helpers/fake-sandbox-provider.ts` — added `runHandler`, a scripted
  per-call result (stdout, stderr, exit code, or a thrown
  `SandboxTimeoutError`). Existing behaviour is unchanged.
- `tests/ticket-06-run-pipeline.test.ts` — 20 tests: 11 through the pipeline and
  the fake transport, 5 for the organizer gate, 4 for the rendered result.

### Response-shape contract (for tickets 10 and 17)

```ts
type RunResult = {
  compileError: string | null;
  timedOut: boolean;
  sandboxError: string | null;
  cases: Array<{
    index: number;        // 0-based sample position (DB position - 1)
    input: string;        // the Sample Test Case input, as authored
    expected: string;     // expected output, as authored
    actual: string;       // stdout, trailing whitespace untouched
    stderr: string;
    exitCode: number | null; // null only when the case timed out
    ms: number;           // from the transport; on a timeout, the limit burned
    pass: boolean;
  }>;
};
```

- `compileError` non-null ⇒ `cases: []`. Nothing ran, so nothing is reported.
- `timedOut` ⇒ at least one case has `exitCode: null`; `sandboxError` is set
  only when the sandbox itself failed, and the cases completed before it are
  still returned (the in-flight case is not fabricated).
- A case passes only with `exitCode === 0` **and** equal output after trimming
  trailing whitespace from both sides. Leading whitespace is significant.
- Refusals (`not_organizer`, `problem_not_found`, `harness_missing`,
  `language_invalid`, `runner_busy` 503) are `DomainError`s thrown by domain
  code and rendered by the route layer. They are not part of `RunResult`.
- Call it as `runAgainstSamples({ problemId, language, code }, { provider })`.
  Participants' ticket should add its own identity/rate-limit gate and call the
  same function; ticket 17 re-runs with the submitted code through the same
  function. Do not add a second result shape.

### Commands and limits

| Language | File | Compile (15s) | Case (stdin) | Memory |
|---|---|---|---|---|
| Python 3 | `main.py` | none (`python3` compiles at start) | `sh -c 'ulimit -v 262144; exec python3 <dir>/main.py'` 3s | `ulimit -v` 256MB |
| C++ | `main.cpp` | `g++ -O2 -std=c++17 -o <dir>/main <dir>/main.cpp` | `sh -c 'ulimit -v 262144; exec <dir>/main'` 3s | `ulimit -v` 256MB |
| Java | `Main.java` | `javac -d <dir> <dir>/Main.java` | `java -Xmx512m -cp <dir> Main` 6s | `-Xmx512m` heap |

- Compile runs once with `timeoutMs: 15000` (`COMPILE_TIMEOUT_MS`); a compile
  timeout returns `compileError` plus `timedOut: true`.
- Each Run gets its own `/work/<serverEpochMs>-<uuid>/` directory, because the
  sandbox is reused (ticket 05 Notes).
- stdout **and stderr** are capped at 64KB of UTF-8 (`OUTPUT_LIMIT_BYTES`)
  before entering the response; compile output is capped the same way.
- Python has no separate compile step, per the brief's command table: a Python
  syntax error appears as two failing cases with the traceback on stderr.

### Verified against the fake transport, not live E2B

Every test runs on `FakeSandboxProvider` with `E2B_API_KEY` unset in the test
environment. Not yet verified against a real sandbox (handed to 18/19): that
`ulimit -v` inside `sh -c` limits a Python/C++ process as expected; that
`javac -d` + `java -Xmx512m -cp` in the template works; that `writeFile`
creates `/work/<dir>` after the explicit `mkdir -p`; and that stdin reaches a
program via `sendStdin`/`closeStdin` without truncation.
