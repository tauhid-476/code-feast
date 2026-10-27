# 05: Warm sandbox pool

**What to build:** A pool of pre-warmed E2B sandboxes stands ready before the Event starts, so a burst of Runs does not queue behind sandbox creation. A Run claims one atomically, health-checks it, uses it, and releases it. When the pool runs short, the request that noticed tops it up in the background rather than making the Participant wait. The Organizer can see how many are ready.

**Blocked by:** 01: Organizer sign-in and role gate

**Status:** ready-for-agent

- [ ] The pool holds warm sandboxes with a target size of 20, created with a 1-hour timeout and no internet egress.
- [ ] Claiming is atomic: two simultaneous claims can never receive the same sandbox, and claiming the last one leaves the other claimer waiting rather than failing incorrectly.
- [ ] Release happens even when the run fails or throws, so no sandbox is leaked by an error path.
- [ ] A claim health-checks the sandbox; a dead row is discarded, replaced, and the claim retried once.
- [ ] A sandbox killed out-of-band is replaced rather than surfacing as a Participant-facing error.
- [ ] Replenishment runs asynchronously from any request that finds the pool short, with no scheduled job.
- [ ] Sandboxes are reused across the Event; no sandbox is destroyed per run.
- [ ] An Organizer can see a ready count that reflects the live pool.
