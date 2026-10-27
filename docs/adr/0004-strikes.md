# Three strikes, counted only for actions that actually happened

Anti-cheat is split into prevention and punishment, and only the second one accumulates strikes. Pasting is blocked at the editor — every route into it — and a blocked attempt is logged for the organizer but costs nothing; penalising an action we successfully prevented punishes nothing and produces false eliminations. Leaving fullscreen, losing window focus, and holding a second live session are counted, one each, and the third eliminates.

Two details make this survivable in a real room. Strikes are deduplicated within a two-second window, because alt-tabbing out of fullscreen can fire `blur` and `fullscreenchange` together and must not cost two. And the organizer can reinstate: the most likely third strike is someone checking a notification, not someone cheating. The cost of reinstatement is low because drafts are autosaved — the participant resumes where they were, still on the original deadline.

## Considered Options

- **Count blocked pastes** — a participant whose muscle memory reaches for Ctrl+V loses a third of their contest for an action that provably did nothing.
- **Soft-flag instead of eliminating** — fairer, but the organizer then has to adjudicate every tab switch during the event, and the rule stops being a deterrent.
- **Client-only enforcement** — a refresh resets the count. Strikes are therefore recorded server-side, and a 5-second heartbeat reporting fullscreen and visibility state catches a client that stops reporting.

## Consequences

Strike counts are permanent for the event and must be visible to the participant, otherwise the third one arrives with no explanation. The threat model is honest about its ceiling: devtools, screen sharing, and a phone under the desk are not detected, and the spec says so rather than implying coverage it does not have.
