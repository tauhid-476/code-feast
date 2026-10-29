# 13: Counted strikes, heartbeat, and elimination

**What to build:** Leaving fullscreen or losing window focus costs a strike, and the count is always visible to the Participant. Two events fired by one alt-tab are deduplicated so they cost one, not two. A five-second heartbeat reports fullscreen and visibility state so a Participant who suppresses the listeners is still caught server-side. The third strike eliminates: the Submission is frozen, the screen becomes terminal, and no device can rejoin. Every strike is timestamped for the Organizer.

**Blocked by:** 09: Contest view: fullscreen gate, editor, autosave

**Status:** resolved

- [x] Leaving fullscreen records a strike of kind `fullscreen_exit`.
- [x] A hidden page or a window blur records a strike of kind `focus_lost`.
- [x] Two strikes fired within a two-second window are recorded as one, so a single alt-tab out of fullscreen costs exactly one.
- [x] The counter is permanent for the Event, survives refresh and rejoin, and is always visible in the form "N of 3".
- [x] The third strike locks the Participant out with reason `eliminated`, freezes the Submission at that moment, and shows the terminal screen.
- [x] A Participant eliminated on one device cannot rejoin from any device.
- [x] The contest page sends a heartbeat every five seconds carrying fullscreen and visibility state.
- [x] A heartbeat reporting a violation the client did not report is counted server-side, and one the client already reported is not counted twice.
- [x] Each strike is logged with kind and timestamp, ready for the review screen.
- [x] A Participant who suppresses the page listeners entirely is still eliminated after three violating heartbeats.

## Notes

Feature commit `1debb95` on `ticket/13-counted-strikes-and-heartbeat`. Tests are
in `tests/ticket-13-counted-strikes-and-heartbeat.test.ts` (21 cases; the full
suite is 242 tests in 17 files). No migration: `participants.strikes`,
`violations`, and `submissions` already existed.

### One counted write

`src/lib/violations/strikes.ts` owns the counted half of SPEC §6.

- `recordStrike` takes the participant row `FOR UPDATE` and then reads the last
  counted violation. A strike inside `STRIKE_DEDUPE_MS` (2s, across kinds) is
  the same event arriving twice: no row and no increment. The row lock is the
  part that matters — `blur` and `fullscreenchange` arrive as two requests, and
  without it both see an empty history and both count. The client repeats the
  same check before sending, but the server is the authority.
- The third strike writes `strikes = 3` and then calls `finalizeLockout` with
  reason `eliminated` **in the same transaction**, so the one Submission is
  frozen from the drafts exactly as they were at that timestamp. A signal that
  loses to a Deadline lock reads `locked_out` and is refused (409), never
  recorded.
- `duplicate_session` is accepted by `recordStrike` for ticket 14 but is not in
  `REPORTABLE_VIOLATION_KINDS`, so `/api/violation` still cannot be told to
  record a second session.

`src/lib/violations/heartbeat.ts` maps a beat to its kinds and calls
`recordStrike` once per kind with the same timestamp; a beat that reports both a
fullscreen exit and a hidden page is one strike. The pure half
(`src/lib/contest/heartbeat.ts`) carries `HEARTBEAT_INTERVAL_MS = 5_000` and the
`document.fullscreenElement` → boolean mapping, and is shared with the browser.
`entered` comes from the gate cookie: a session that never crossed the gate has
not exited fullscreen. `logViolation` now refuses counted kinds outright and
shares its refusals with `recordStrike` through `src/lib/violations/guard.ts`.

A violating beat outside the dedupe window counts, so three violating beats
eliminate. That is what the last checklist line needs: suppressing the page
events does not suppress the beat. The 2s window is what keeps an in-flight beat
from charging for the event the client just sent, and keeps one alt-tab at one
strike. The consequence is that staying away costs roughly one strike per beat,
which is intentional and is now explained to the Participant.

### The client

`useContestSupervision` (`src/components/use-contest-supervision.ts`) replaces
`use-anti-cheat.ts` and owns everything the page reports:

- `fullscreenchange`, `visibilitychange`, and `blur` listeners, each mapped to
  the counted kind;
- `POST /api/heartbeat` every five seconds with `fullscreen` (from
  `document.fullscreenElement`) and `visibilityState`. No beat is sent at mount:
  the page has just entered fullscreen by a user gesture, and a mid-transition
  snapshot must not invent an exit;
- the strike count. It starts from the loader (`strikes` prop through the
  contest page, so refresh and rejoin are already permanent) and updates from
  every response. An elimination or any lockout response calls
  `router.refresh()`, which reconciles and lands on the existing terminal screen;
- `outOfFullscreen`, read through `useSyncExternalStore` so a refresh that
  dropped fullscreen is visible without a hydration mismatch.

The workspace shows a persistent **Fullscreen ended** alert with **Return
fullscreen** whenever the document is not fullscreen. Fullscreen can only be
requested from a gesture, so without that button a refresh (which exits
fullscreen while the gate cookie survives) would leave a participant with no way
to stop the beats from eliminating them. The alert is not a gate: the editor
stays usable, the strike is the enforcement.

The editor guards now receive `onViolation` as a prop instead of owning their
own reporter, so a blocked paste and a strike share one counter and one dedupe
story. `StrikeCounter` is the permanent **N of 3** badge in the contest header;
it turns destructive at 2 of 3.

The countdown keeps its own read-only `/api/clock` poll rather than folding into
the heartbeat. The heartbeat is a write path; a lost beat must never freeze the
displayed clock. The clock still re-anchors every 10s from the server.

### Deployment

No migration and no new environment variable. `docs/verify-deploy.md` step 6 now
covers the counter, the one-alt-tab case, the heartbeat, elimination, and the
**Return fullscreen** recovery, and the failure table names the new symptoms
(counter never moves, counted row missing, refresh banner, heartbeat 409).

Merge commit: `97d3ccd` (`git merge --no-ff` into `feat/live-contest`, parent
`c15a636`). The merge gate passed on the merged tree: `npm test` 17 files /
242 tests, `npm run typecheck`, `npm run lint`, and `npm run build` all green.
No migration and no new environment variable, so nothing to deploy for this
ticket beyond the code.
