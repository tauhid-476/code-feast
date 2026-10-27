# 03: Author a problem

**What to build:** Inside a `draft` Event, the Organizer builds the Problem set: each Problem has a title, an optional difficulty label, a Markdown statement, and exactly two Sample Test Cases. Problems have an order the Organizer controls. Nothing here is visible to Participants, who cannot reach the authoring surface at all.

**Blocked by:** 02: Create and list a draft event

**Status:** ready-for-agent

- [ ] An Organizer can add a Problem to a `draft` Event with a title, an optional difficulty label, and a Markdown statement.
- [ ] The statement renders as Markdown in the authoring preview and (later) to Participants.
- [ ] The difficulty label is display-only: no behaviour anywhere reads it.
- [ ] Each Problem holds exactly two Sample Test Cases with input text and expected output text, and saving with fewer than two is refused with a clear message.
- [ ] Sample Test Cases have an order and are presented in that order.
- [ ] Problems can be reordered, and the new order persists across reloads.
- [ ] Authoring is refused once the Event is no longer `draft`.
- [ ] A Participant cannot read or reach the authoring surface.
