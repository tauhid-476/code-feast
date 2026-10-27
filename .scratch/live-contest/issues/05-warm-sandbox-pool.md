# 05: Warm sandbox pool

**What to build:** A pool of pre-warmed E2B sandboxes stands ready before the Event starts, so a burst of Runs does not queue behind sandbox creation. A Run claims one atomically, health-checks it, uses it, and releases it. When the pool runs short, the request that noticed tops it up in the background rather than making the Participant wait. The Organizer can see how many are ready.

**Blocked by:** 01: Organizer sign-in and role gate

**Status:** resolved

- [x] The pool holds warm sandboxes with a target size of 20, created with a 1-hour timeout and no internet egress.
- [x] Claiming is atomic: two simultaneous claims can never receive the same sandbox, and claiming the last one leaves the other claimer waiting rather than failing incorrectly.
- [x] Release happens even when the run fails or throws, so no sandbox is leaked by an error path.
- [x] A claim health-checks the sandbox; a dead row is discarded, replaced, and the claim retried once.
- [x] A sandbox killed out-of-band is replaced rather than surfacing as a Participant-facing error.
- [x] Replenishment runs asynchronously from any request that finds the pool short, with no scheduled job.
- [x] Sandboxes are reused across the Event; no sandbox is destroyed per run.
- [x] An Organizer can see a ready count that reflects the live pool.

## Notes

Built as a database-backed queue in `runner_pool` behind a transport seam, so
the pool logic is exercised without an E2B key.

**Files**

- `src/lib/runner/sandbox.ts` — `SandboxProvider` / `SandboxHandle` seam,
  `createE2BSandboxProvider()` (real E2B), `SANDBOX_TIMEOUT_MS` (1 hour),
  `SandboxTimeoutError` (a normal TLE outcome, distinct from a dead sandbox),
  and `e2bSandboxProvider` (the app-wide instance).
- `src/lib/runner/pool.ts` — `replenishPool`, `claimSandbox`,
  `releaseSandbox`, `withClaimedSandbox`, `getReadyCount`, `scheduleReplenish`,
  `POOL_TARGET = 20`, `CLAIM_TIMEOUT_MS = 20_000`.
- `src/lib/env.ts` — `e2bApiKey()` / `e2bTemplateId()`, read lazily so the app
  builds and the suite runs with an empty `E2B_API_KEY`.
- `tests/helpers/fake-sandbox-provider.ts` — recording fake transport.
- `tests/ticket-05-warm-sandbox-pool.test.ts` — 14 tests.

**How the guarantees are met**

- Atomic claim is one `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP
  LOCKED) RETURNING`, so a row can only be won once. An empty pool polls every
  100ms until `CLAIM_TIMEOUT_MS`, then throws `runner_busy` (503).
- `withClaimedSandbox` releases in `finally`; release is a conditional update
  (`state = 'claimed'`), so a late release cannot resurrect a dead row.
- A claim connects and checks `isRunning()`. A failure marks the row `dead`,
  creates one replacement, and retries once; a second failure is `runner_busy`.
- `replenishPool` counts ready + claimed rows, so an in-flight Run still counts
  toward the target, and holds a Postgres advisory lock so concurrent callers
  do not overshoot. `scheduleReplenish()` returns a callback for Next's
  `after()`; there is no cron.
- Sandboxes are only killed when a row cannot be inserted or the pool is
  discarded; release never kills. Sandboxes are reused for the whole event.

**Verified against the fake provider, not live E2B**

Every pool test above runs against `FakeSandboxProvider`. `E2B_API_KEY` was
empty while this ticket was built, so the following are **not** yet verified
against a real sandbox and are handed to tickets 18/19:

- real `Sandbox.create` latency and the 1-creation-per-second pacing gate;
- whether `allowInternetAccess: false` actually blocks egress in the deployed
  template;
- whether `commands.run({ background: true, stdin: true })` +
  `sendStdin`/`closeStdin` behaves as the installed types claim for a program
  that reads until EOF;
- `isRunning()` behaviour on a sandbox killed out-of-band at the API level.

The provider refuses with a clear `runner_not_configured` DomainError (503)
when a key is missing, which is the only path currently reachable in
production.

**For ticket 06**

```ts
withClaimedSandbox({ provider?, timeoutMs? }, async (claim) => {
  await claim.handle.writeFile("/work/main.py", source + harness);
  const result = await claim.handle.run("python3 /work/main.py", {
    stdin: input,
    timeoutMs: 3_000,
  }); // { stdout, stderr, exitCode, ms }
});
```

`SandboxTimeoutError` means TLE; any other throw means a sandbox error. Both
must be reported, not swallowed. The handle is reused across Runs, so write
files under a per-run directory to avoid stale artifacts.
