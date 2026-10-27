# Code Feast

A platform for running one live DSA contest: an organizer authors an event and its problems, participants solve them under a shared clock, and the organizer judges the submitted code by hand.

## Language

**Event**:
One contest: a set of problems, a start moment, and a fixed duration. Everything a participant does is scoped to a single event.
_Avoid_: Contest, competition, room, session

**Organizer**:
The account that owns an event, authors its problems, starts its clock, and reviews its submissions. Exactly one per event.
_Avoid_: Admin, host, judge, evaluator

**Participant**:
A registered account that joins an event with its join code and submits exactly one submission to it.
_Avoid_: User, contestant, player, student

**Join Code**:
The short code an organizer shares so participants can enter a specific event. It grants entry, not identity.
_Avoid_: Event ID, invite, password, link

**Problem**:
One question inside an event, authored by the organizer, with a statement and a starter function per language.
_Avoid_: Question, challenge, task, exercise

**Sample Test Case**:
An input/expected-output pair shown to participants so they can self-check. It carries no score and does not affect the outcome.
_Avoid_: Hidden test, judge case, official test

**Lobby**:
The participant's view of an event before its clock starts: joined and identified, with no problem content visible.
_Avoid_: Waiting room, queue, pre-game

**Starter Code**:
The visible per-language file a participant is given for a problem, containing the signed function they are meant to complete.
_Avoid_: Template, skeleton, boilerplate, scaffold

**Harness**:
The hidden per-language code appended to Starter Code at run time, which parses the sample input and calls the function. Never shown to participants, never part of a submission.
_Avoid_: Wrapper, driver, runner, scaffold

**Run**:
A participant-requested execution of their current code against the sample test cases. It produces feedback only, and is never recorded as a submission.
_Avoid_: Test, execute, check, attempt

**Submission**:
The single terminal artifact a participant produces for an event: the code of every problem at the moment they are locked out, plus the reason they were locked out.
_Avoid_: Answer, attempt, entry, solution set

**Lockout**:
The moment a participant's submission is frozen, whether by their own choice, by the clock reaching its deadline, or by elimination. Only reinstatement reverses it.
_Avoid_: Finish, end, hand-in, close

**Strike**:
A recorded anti-cheat violation: leaving fullscreen, losing window focus, or holding the event open in two places. Three strikes eliminate.
_Avoid_: Warning, flag, infraction, penalty

**Elimination**:
The lockout caused by a third strike. The submission is kept and stays visible to the organizer, who may still judge it or reinstate the participant.
_Avoid_: Disqualification, ban, kick, DQ

**Shortlist**:
An organizer's private mark on a participant whose submission is worth revisiting while judging.
_Avoid_: Star, favourite, pick, bookmark

**Deadline**:
The single wall-clock instant at which every participant's event ends. Derived from the organizer's start action plus the event duration, and owned by the server.
_Avoid_: Timer, time limit, cutoff
