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
