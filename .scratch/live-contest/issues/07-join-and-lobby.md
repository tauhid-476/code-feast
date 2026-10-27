# 07: Join by code and the lobby

**What to build:** A Participant enters the Join Code and lands in the Lobby for that Event, identified by name, waiting for the Organizer. Re-entering the code returns them to the same place rather than creating a second entry. The Lobby shows the Event title, its duration, and their own name — no Problem content, no Problem list. An Organizer cannot join any Event, including their own.

**Blocked by:** 02: Create and list a draft event

**Status:** ready-for-agent

- [ ] A Participant enters a Join Code and receives exactly one participant entry per Event, regardless of how many times they enter the code.
- [ ] Re-entering the code while the Event is `draft` returns the existing entry and the Lobby, not an error and not a duplicate.
- [ ] The Lobby shows the Event title, its duration, the Participant's display name, and a waiting message, with no Problem content and no Problem list.
- [ ] An Organizer is refused entry to any Event by Join Code, including one they created, with an explanation rather than a silent failure.
- [ ] An unknown, expired, or ended Join Code produces a clear refusal.
- [ ] A Participant who joins while the Event is `live` is accepted and inherits the existing shared Deadline with nothing prorated.
- [ ] Re-entering the code while `live` takes the Participant straight to the contest, not back to the Lobby.
- [ ] The editor bundle is preloaded in the Lobby so entering the contest does not stall on a download.
