# The server owns one shared clock and the lockout

Every participant in an event races the same wall-clock deadline, set when the organizer presses Start, and no participant can begin or extend their own time. Lockout is not an event a client schedules; it is a fact the server reconciles on read: once `now >= deadline_at`, the participant is locked with `locked_at = deadline_at`, whatever they did with their browser.

This looks over-engineered for a small event until you consider the alternative. A per-participant clock that starts when they click Start is easy to build and impossible to judge fairly, because everyone finishes at a different moment. A client-side countdown is easier still, and it can be defeated by changing the system clock or by closing the laptop.

## Considered Options

- **Self-start per participant** — fair to latecomers, but produces no shared end, and judging overlaps with solving.
- **Client-side deadline** — trivially spoofable, and a refresh during the final seconds becomes a way to steal time.
- **Scheduled start time** — removes the organizer from the loop but cannot react to a room that is still filling up at the advertised minute. Manual Start with a confirmation is better for a WhatsApp-coordinated event.

## Consequences

Every read path that touches a participant must check the deadline, because there is no job that will do it for you. The substitution rule in `SPEC.md` §3 — extending an ended-by-deadline event reopens only `deadline` lockouts — exists because the reverse, reopening everyone, would undo eliminations.

The client still renders a countdown, but it is a projection of server time, corrected for skew and re-derived on each poll.
