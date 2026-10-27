# 18: Production deploy

**What to build:** The app runs on its real host against its real database and its real sandbox account, so the rehearsal happens on the same footing as the Event. Sign-in returns to the right place, sandboxes can be created from the deployed app, and the full organizer-to-participant path works over HTTPS.

**Blocked by:** 08: Start, the shared clock, and status gates

**Status:** ready-for-agent

- [ ] The app is deployed and served over HTTPS, with authentication working against the production database.
- [ ] Sign-in and sign-out return to the deployed host rather than a local address.
- [ ] Sandboxes can be created and claimed from the deployed app, and the pool reaches its target size.
- [ ] A smoke path passes on the deployed URL: sign in as Organizer, author an Event with one Problem, start it, and join as a Participant.
- [ ] Environment configuration is documented, and no secret value reaches the browser bundle.
- [ ] Fullscreen is granted on the deployed host, confirming the secure-context requirement is met.
- [ ] A deploy can be repeated without manual data repair, and the schema is applied by a repeatable migration path.
