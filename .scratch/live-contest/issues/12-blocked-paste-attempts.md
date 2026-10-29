# 12: Blocked paste attempts

**What to build:** Pasting into the editor is prevented on every route into it — the shortcut, the context menu, middle click, drag and drop, and the editor's own paste command — and the Participant is told it is disabled. Right-click inside the editor is suppressed. Copying out is allowed. Each blocked attempt is logged for the Organizer but costs the Participant nothing, because a prevented action is not a cheat.

**Blocked by:** 09: Contest view: fullscreen gate, editor, autosave

**Status:** resolved

- [x] Pasting is blocked via the keyboard shortcut, the context menu, middle click, drag and drop, and the editor's built-in paste command.
- [x] Every blocked route produces the same toast: "Pasting is disabled."
- [x] The right-click context menu inside the editor is suppressed.
- [x] Copying out of the editor is allowed and unaffected.
- [x] Each blocked attempt is logged with its kind and a timestamp, marked uncounted.
- [x] Blocked attempts never increment the Participant's strike count, however many occur.
- [x] Blocked attempts are recorded server-side, so they survive a refresh.
- [x] A blocked attempt never interrupts typing or undo history.

## Notes

Feature commit `23681df`, merge commit `a2579fb`. No migration: the `violations`
table and its `paste_blocked` / `context_menu_blocked` kinds already existed.

- `src/lib/contest/anti-cheat.ts` is the one mapper: `blockedKindFor` answers
  "is this a blocked attempt, and which one?" for Monaco and DOM events, so the
  guards and their tests cannot disagree. `shouldReportAttempt` collapses the
  duplicate signals from one gesture inside 250ms.
- `src/components/editor-guards.ts` installs the guards against a small
  `GuardEditor` type, so the ticket test drives a fake editor with no browser.
  It blocks Monaco's paste command (`addCommand` for Ctrl/Cmd+V), the keyboard
  event, `paste`, `drop`, `dragover` (prevented only, not reported), a middle
  `mousedown`, and `contextmenu`. There is deliberately no copy or cut listener.
  `addCommand` has no removal API, so the command lives and dies with the editor
  instance; the DOM and Monaco listeners are disposed on unmount.
- `src/lib/violations/log.ts` writes the row with the server's clock, and
  uncounted kinds are forced uncounted by kind, whatever a caller passes. It
  writes no strike and no lockout: ticket 13 owns counted strikes.
- `src/app/api/violation/route.ts` accepts only the two uncounted kinds, so a
  blocked attempt cannot be smuggled in as a counted one. The participant is
  resolved through the loader, so a paste after the Deadline is refused (409)
  rather than recorded.
- The toast fires only for `paste_blocked`; a suppressed context menu is silent
  (SPEC §6 asks for the toast on pasting only).
- `docs/verify-deploy.md` step 6 covers the blocked routes and the `violations`
  SQL check; the failure table gained "pasting still works" and "no row
  appears".

The first merge attempt failed on `ECONNRESET` from the remote test database
(two truncate failures in ticket 04, no assertion failures) and was rolled
back. The retry passed all gates: 221 tests, 16 files.
