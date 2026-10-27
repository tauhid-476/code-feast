# 02: Create and list a draft event

**What to build:** An Organizer creates an Event from a title and a duration in minutes, receives a Join Code to share, and sees the Event listed among their events. The Event begins in `draft` and stays editable. The Join Code is short enough to read aloud and can be regenerated while the Event is still `draft`.

**Blocked by:** 01: Organizer sign-in and role gate

**Status:** ready-for-agent

- [ ] An Organizer can create an Event with a title and a duration in minutes; it is created in `draft` and attributed to that Organizer.
- [ ] Every Event gets a 6-character uppercase alphanumeric Join Code that is unique among non-ended Events.
- [ ] A Join Code collision is retried automatically; two Events are never issued the same live code.
- [ ] An Organizer can regenerate the Join Code while the Event is `draft`, and the previous code stops working immediately.
- [ ] Regeneration is refused once the Event is no longer `draft`.
- [ ] The events list shows title, status, duration, and Join Code, and is scoped to organizer surfaces only.
- [ ] Two draft Events can exist at once; creating a second one does not disturb the first.
- [ ] A Participant cannot create an Event.
