# 16: Review dashboard and shortlist

**What to build:** The Organizer opens one Event's roster and sees every Participant with what happened to them: name, email, status, when they joined, when and why they were locked out, how long they worked, and how many strikes they took. Clicking a row opens their Submission as read-only code, one tab per Problem, with the full strike log beneath — including the pastes that were blocked and never counted. A Shortlist mark lets the Organizer keep track of the submissions worth revisiting.

**Blocked by:** 11: Submit and the locked screen; 13: Counted strikes, heartbeat, and elimination

**Status:** ready-for-agent

- [ ] The roster lists every Participant in the Event with display name, email, status, joined time, locked-out time, lockout reason, elapsed time, and strike count.
- [ ] Submitted, deadline-locked, and eliminated Participants all appear, distinguished by reason.
- [ ] Opening a Participant shows one tab per Problem containing the language they used and their submitted code, read-only.
- [ ] The strike log sits below the code and includes blocked attempts marked uncounted, each with kind and timestamp.
- [ ] The Organizer can mark and unmark a Participant as shortlisted, and the mark persists.
- [ ] Shortlist marks are visible only to Organizers.
- [ ] There is no live view of in-progress code and no winner field anywhere on the surface.
- [ ] The surface is unreachable to Participants.
- [ ] A Participant eliminated with only two visible strikes still shows every strike that was recorded against them.
