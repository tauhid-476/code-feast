# 08: Start, the shared clock, and status gates

**What to build:** The Organizer starts the Event with a confirmation that names how many Participants are waiting, and from that instant every Participant races the same Deadline. Problems become visible at that moment and stop being editable. The Organizer can add ten minutes while the Event is live, or end it early. Lockout by Deadline is a fact the server reconciles whenever it reads a Participant — never something a client or a scheduled job performs.

**Blocked by:** 03: Author a problem; 07: Join by code and the lobby

**Status:** ready-for-agent

- [ ] Start is a single Organizer action behind a confirmation that names the current participant count.
- [ ] Start sets the start moment to now, sets the Deadline to now plus the Event duration, and freezes the Problem set in one transaction.
- [ ] There is no scheduled start; nothing happens until the Organizer presses Start.
- [ ] Problems are invisible to Participants before Start and visible from Start onward.
- [ ] Extend adds ten minutes to the Deadline, repeatable, and is offered only while the Event is `live`.
- [ ] End now sets the Deadline to now and locks everyone immediately.
- [ ] Every read that touches a Participant reconciles the Deadline: at or past it and not yet locked means locked with reason `deadline` and a locked-out time equal to the Deadline, not the moment it was noticed.
- [ ] A Participant who joins late inherits the existing Deadline and nothing is prorated.
- [ ] Problem, Starter Code, Harness, and Sample Test Case edits are all refused once the Event is no longer `draft`.
- [ ] A double Start or a double Extend does not apply the action twice.
- [ ] The Organizer's live view shows participants joined, solving, and locked, the sandbox pool ready count, and the time remaining.
