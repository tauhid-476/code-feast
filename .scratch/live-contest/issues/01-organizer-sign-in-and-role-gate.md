# 01: Organizer sign-in and role gate

**What to build:** A person can register with email and password and sign in to the app. The app then decides, from the organizer email list alone, whether they are an Organizer or a Participant, and sends each to their own landing surface. An Organizer lands on an empty admin events list; a Participant lands on Join Code entry. Unauthenticated and wrong-role access to organizer surfaces is refused outright rather than shown empty.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Registration and sign-in with email and password work, with no OAuth and no email verification step.
- [ ] An account whose email appears in `ADMIN_EMAILS` behaves as an Organizer everywhere in the app; every other account behaves as a Participant.
- [ ] Adding a second email to `ADMIN_EMAILS` grants that account the Organizer role on next sign-in, with no code change and no migration.
- [ ] The root route sends a signed-out visitor to sign-in, an Organizer to the admin events list, and a Participant to Join Code entry.
- [ ] An unauthenticated request to an organizer surface is refused, and a Participant hitting one is refused rather than shown an empty admin page.
- [ ] An Organizer sees an empty admin events list; a Participant sees Join Code entry.
- [ ] The `events` table exists and is written through the app's data layer, so later slices add tables beside it rather than replacing it.
