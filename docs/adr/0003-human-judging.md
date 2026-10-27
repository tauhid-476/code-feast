# Judging is human; the sample cases carry no score

The platform stores code, not results. Sample test cases exist so a participant can check their own work, and nothing about them — pass count, attempt count, timing — contributes to who wins. The organizer reads each submission and announces a winner outside the app.

This is a deliberate scope boundary, and it is the reason the rest of the system stays small. Automated scoring would force hidden test cases, per-problem submissions, partial credit, tie-breaking, and a scoring model the organizer would then have to argue with. A club event with five problems and fifty participants does not need a judge; it needs a clean reading surface.

The sample cases still have to be *correct*, because a broken one sends participants debugging their correct code. That is what the organizer's test panel is for.

## Consequences

The app cannot answer "who won", and should not pretend to. Re-running a submission exists only so a judge can see behaviour, not to produce a verdict. If scoring is ever wanted, it is a different product with a different submission model — one submission per problem instead of one per contest — and it should be designed as such rather than accreted.
