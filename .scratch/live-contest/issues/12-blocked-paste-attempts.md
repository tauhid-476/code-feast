# 12: Blocked paste attempts

**What to build:** Pasting into the editor is prevented on every route into it — the shortcut, the context menu, middle click, drag and drop, and the editor's own paste command — and the Participant is told it is disabled. Right-click inside the editor is suppressed. Copying out is allowed. Each blocked attempt is logged for the Organizer but costs the Participant nothing, because a prevented action is not a cheat.

**Blocked by:** 09: Contest view: fullscreen gate, editor, autosave

**Status:** ready-for-agent

- [ ] Pasting is blocked via the keyboard shortcut, the context menu, middle click, drag and drop, and the editor's built-in paste command.
- [ ] Every blocked route produces the same toast: "Pasting is disabled."
- [ ] The right-click context menu inside the editor is suppressed.
- [ ] Copying out of the editor is allowed and unaffected.
- [ ] Each blocked attempt is logged with its kind and a timestamp, marked uncounted.
- [ ] Blocked attempts never increment the Participant's strike count, however many occur.
- [ ] Blocked attempts are recorded server-side, so they survive a refresh.
- [ ] A blocked attempt never interrupts typing or undo history.
