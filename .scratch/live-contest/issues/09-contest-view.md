# 09: Contest view: fullscreen gate, editor, autosave

**What to build:** When the Event goes live the Lobby offers one primary action — Enter fullscreen — and the contest is unreachable without it, because browsers only grant fullscreen from a user gesture. Inside, the Participant works in a split pane: the Problem list and statement on the left, and on the right a language selector, the editor seeded with that language's Starter Code, Run, and a global Submit. Work is autosaved continuously, a refresh returns them to it with the clock still running, and failure to save is visible rather than silent.

**Blocked by:** 08: Start, the shared clock, and status gates

**Status:** ready-for-agent

- [ ] When the Event is live, the Lobby shows Enter fullscreen as its single primary action.
- [ ] The contest route is unreachable without entering fullscreen; navigating to it directly returns the Participant to the gate.
- [ ] The split pane shows the Problem list and selected Problem's statement on the left, and language selector, editor, Run, and Submit on the right, with Submit in the top right.
- [ ] Selecting a language seeds the editor with that Problem's Starter Code for that language, and switching language keeps each language's own work.
- [ ] The Participant's code is autosaved per Problem per language and survives a refresh and a browser crash.
- [ ] A refresh returns the Participant to the contest with their code and the still-running shared clock.
- [ ] A failed autosave raises a persistent "Not saved" banner, mirrors the buffer locally, resyncs on reconnect, and prefers the newer local copy.
- [ ] The countdown is a projection of server time corrected for clock skew, re-derived on each poll, and unaffected by a tampered local clock.
- [ ] The signed function from Starter Code is present on first load, so a Participant can Run without writing boilerplate.
