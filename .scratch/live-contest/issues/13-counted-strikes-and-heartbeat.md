# 13: Counted strikes, heartbeat, and elimination

**What to build:** Leaving fullscreen or losing window focus costs a strike, and the count is always visible to the Participant. Two events fired by one alt-tab are deduplicated so they cost one, not two. A five-second heartbeat reports fullscreen and visibility state so a Participant who suppresses the listeners is still caught server-side. The third strike eliminates: the Submission is frozen, the screen becomes terminal, and no device can rejoin. Every strike is timestamped for the Organizer.

**Blocked by:** 09: Contest view: fullscreen gate, editor, autosave

**Status:** ready-for-agent

- [ ] Leaving fullscreen records a strike of kind `fullscreen_exit`.
- [ ] A hidden page or a window blur records a strike of kind `focus_lost`.
- [ ] Two strikes fired within a two-second window are recorded as one, so a single alt-tab out of fullscreen costs exactly one.
- [ ] The counter is permanent for the Event, survives refresh and rejoin, and is always visible in the form "N of 3".
- [ ] The third strike locks the Participant out with reason `eliminated`, freezes the Submission at that moment, and shows the terminal screen.
- [ ] A Participant eliminated on one device cannot rejoin from any device.
- [ ] The contest page sends a heartbeat every five seconds carrying fullscreen and visibility state.
- [ ] A heartbeat reporting a violation the client did not report is counted server-side, and one the client already reported is not counted twice.
- [ ] Each strike is logged with kind and timestamp, ready for the review screen.
- [ ] A Participant who suppresses the page listeners entirely is still eliminated after three violating heartbeats.
