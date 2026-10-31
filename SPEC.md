# Code Feast — Specification

A platform for running one live DSA contest. An organizer authors an event and its problems, shares a join code, starts a shared clock, and participants solve problems in a LeetCode-style editor under anti-cheat supervision. Judging is done by a human reading the submitted code.

Decisions referenced: `docs/adr/0001`–`0004`. Vocabulary: `GLOSSARY.md`.

---

## 1. Scope

One organizer, one event at a time, 30–60 participants, 4–6 problems, ~90 minutes, three languages (Python 3, Java, C++), desktop only.

The system does four things: authoring, entry, solving under a clock, and reviewing submissions. It does not score anything.

---

## 2. Actors

| Actor | How they are identified | What they can do |
|---|---|---|
| Organizer | Neon Auth account whose email is listed in `ADMIN_EMAILS` | Create events, author problems, start/extend/end, reinstate, review submissions, shortlist |
| Participant | Any other Neon Auth account | Join with a code, solve, run, submit |

An organizer cannot join any event. Only organizers can create events. There is exactly one organizer role; co-organizers are additional emails in the same variable.

---

## 3. Event lifecycle

```
draft ──start──> live ──deadline──> ended
  │                │                 │
  │                └──end now───────>│
  │                                  │
  └──── (problems editable) ─────────┘
```

| Status | Problems visible | Participants | Editable |
|---|---|---|---|
| `draft` | No | Can join and wait in the lobby | Everything |
| `live` | Yes | Solving | Nothing but the deadline |
| `ended` | Yes | Locked | Nothing |

- **Start** is a single organizer action with a confirmation naming the participant count. It sets `starts_at = now`, `deadline_at = now + duration_minutes`, and freezes every problem in one transaction. There is no scheduled start.
- **Extend** adds 10 minutes to `deadline_at`, repeatable, available while `live`. It is also available in `ended` **only if the event ended by deadline**, and it reopens exactly the participants whose lockout reason was `deadline`. Participants locked by `submitted` or `eliminated` stay locked.
- **End now** sets `deadline_at = now` and locks everyone immediately.
- A late joiner in `live` inherits the existing shared deadline. Nothing is prorated.

---

## 4. Organizer flows

### 4.1 Create event
Title, duration in minutes. Generates a 6-character uppercase alphanumeric join code, unique among non-ended events, regenerable while `draft`.

### 4.2 Author a problem
- Title, optional difficulty label (display only), statement in Markdown, optional constraints block.
- **Starter code per language**: a full file containing the signed function (e.g. `def two_sum(nums, target)`) that the participant sees.
- **Harness per language**: hidden snippet appended server-side after the participant's code at run time. Carries the stdin parsing and the call. Not shown to participants, not marked read-only to the organizer, never included in a submission.
- **Sample test cases**: exactly two per problem (input text, expected output text). Shown to participants with the statement.
- **Figures** (optional): a picture uploaded to object storage and referenced from the statement as `/api/figures/<id>`, for graph, tree and linked-list problems. PNG, JPEG or WebP, 2MB each, six per problem. Display-only: never part of a sample's input, never reaching the harness or the runner. A remote image URL is not rendered as an image.
- Reordering by position.

### 4.3 Test a problem
A **Test this problem** panel per problem per language: paste a reference solution, run it against that problem's two sample cases through the real runner and the real harness. Returns the same result shape participants see. This exists because a broken harness fails every participant at once.

### 4.4 Live controls
Start event · Extend +10 · End now. Plus a health strip: participants joined / solving / locked, sandbox pool ready count, time remaining.

### 4.5 Review
Per event, a table: display name, email, status, joined at, locked out at, reason, elapsed, strikes.
Click a row: one tab per problem showing the submitted language and code, read-only, plus a **Run** button that executes that submitted code against the samples. Strike log below, including blocked (uncounted) attempts. A **Shortlist** star per participant.

No live view of in-progress code. No winner field.

---

## 5. Participant flows

1. **Register** — email + password. No OAuth. Email verification is disabled in the Neon Auth console.
2. **Join** — enter the join code. Creates one participant row per (event, user). Re-entering the code returns the existing row.
3. **Lobby** — event title, duration, the participant's name, and "waiting for the organizer". No problem content, no problems list.
4. **Start gate** — when the event goes `live`, the lobby shows a single primary action: **Enter fullscreen**. The Contest view is unreachable without it, because fullscreen requires a user gesture.
5. **Contest** — split pane. Left: problem list and statement. Right: language selector, Monaco editor, **Run**, and the global **Submit** in the top right.
6. **Run** — executes the current code against both sample cases. Shows per-case pass/fail with actual vs expected and compile output. Never recorded as a submission, no attempt limit besides rate limiting.
7. **Submit** — confirmation ("This ends your contest and cannot be undone"). Locks out with reason `submitted`.
8. **Locked** — terminal screen: submitted, reason, elapsed. Code is no longer viewable or editable.

Code is autosaved; closing the tab is not the same as submitting, but it is also not a way to escape — the deadline still locks them out.

---

## 6. Anti-cheat

Two categories, deliberately separated.

**Blocked, logged, never counted as a strike:**
- Paste by any route: `Ctrl/Cmd+V`, context menu, middle click, drag-and-drop, Monaco's paste command. Toast: "Pasting is disabled."
- Right-click context menu inside the editor.
- Copying out is allowed.

**Counted — one strike each:**
| Kind | Detection |
|---|---|
| `fullscreen_exit` | `fullscreenchange` when `document.fullscreenElement` becomes null |
| `focus_lost` | `visibilitychange` to hidden, or window `blur` |
| `duplicate_session` | second live session for the same participant; the newest wins, the older becomes read-only |

- Strikes are **deduplicated within a 2s window**, because alt-tabbing out of fullscreen can fire both events at once and must not cost two strikes.
- The counter is permanent for the event and always visible ("1 of 3").
- The **third strike eliminates**: lockout with reason `eliminated`, submission frozen, terminal screen, no rejoin from any device.
- Every strike is logged with kind and timestamp; the review screen shows them.
- **Reinstate** clears strikes, returns the participant to `solving`, and keeps their original deadline. No time refund. Disabled once the event has ended.
- Enforcement does not rely on the events alone: the contest page sends a **5s heartbeat** carrying `fullscreenElement` and `visibilityState`. A heartbeat reporting a violation the client did not report is counted server-side. This is what makes suppressing the listeners ineffective.

Explicitly out of scope, and stated as such rather than faked: devtools, screen sharing, a second physical device, a person sitting next to them.

---

## 7. Code execution

**E2B** sandboxes, one template containing Python 3, `g++`, and a JDK.

**Pool, not per-request creation.** E2B allows one sandbox creation per second per account; a 60-person Run burst would queue for a minute if each request created its own. So:

- `runner_pool` rows hold warm sandboxes. Target size **20**.
- Claim atomically in Postgres (`FOR UPDATE SKIP LOCKED`), release in `finally`.
- Replenishment happens asynchronously via `waitUntil` on any request that finds the pool short; no cron, since Hobby cron cannot run every minute.
- A claim health-checks the sandbox (`connect`); dead rows are replaced and the request retries.
- Sandboxes are created with a 1-hour timeout and are reused for the whole event. No kill-per-run.

**Limits:** Python/C++ 3s and 256MB per case; Java 6s and 512MB (JVM startup). Compile 15s. stdout truncated at 64KB. Input delivered on stdin, expected output compared after trimming trailing whitespace on both sides. Both sample cases always run, even if the first fails.

**Rate limit:** one in-flight run per participant, minimum 2s between runs. If no sandbox is claimable within 20s, return 503 with "The runner is busy, try again in a moment." The clock never pauses.

**Response shape** (identical for participants and for the organizer's test panel and re-runs):
```ts
{
  compileError: string | null,
  timedOut: boolean,
  sandboxError: string | null,
  cases: Array<{
    index: number, input: string, expected: string,
    actual: string, stderr: string,
    exitCode: number | null, ms: number, pass: boolean
  }>
}
```

---

## 8. Data model

Neon Postgres. Auth users live in the `neon_auth` schema and are referenced by id.

```
events(id, title, code, status, duration_minutes,
       starts_at, deadline_at, ended_at, created_by, created_at)

problems(id, event_id, position, title, difficulty, statement_md, created_at)

problem_starters(id, problem_id, language, starter_code, harness_code)
  unique(problem_id, language)

test_cases(id, problem_id, position, input, expected_output)

problem_figures(id, problem_id, storage_key, content_type, bytes,
                width, height, state, created_at)
  unique(storage_key); state ∈ {pending, ready}

participants(id, event_id, user_id, display_name, email,
             status, joined_at, locked_at, lockout_reason,
             strikes, shortlisted, active_session_id, last_seen_at)
  unique(event_id, user_id)

drafts(id, participant_id, problem_id, language, code, updated_at)
  unique(participant_id, problem_id, language)

submissions(id, participant_id, locked_at, reason, created_at)
  unique(participant_id)

submission_snippets(id, submission_id, problem_id, language, code)

violations(id, participant_id, kind, counted, created_at)
```

Statuses: `participants.status ∈ {joined, solving, locked_out}`; `lockout_reason ∈ {submitted, deadline, eliminated}`.

**Lockout is reconciled, not scheduled.** Every read that touches a participant checks `now >= deadline_at`; if so and they are not locked, they are locked with reason `deadline` and `locked_at = deadline_at` (not "when we noticed"). There is no job to miss, and a closed laptop at minute 88 still produces a correct submission.

**The deadline is server-owned.** The client renders `deadline_at - serverNow` corrected for clock skew and reconciles on every poll; a tampered local clock changes nothing.

---

## 9. Routes

```
/                        landing, redirect by role
/sign-in  /sign-up
/join                    code entry
/e/[code]                lobby
/e/[code]/contest        split pane (gated on fullscreen)
/e/[code]/locked         terminal

/admin/events
/admin/events/[id]                     authoring: problems, starters, harnesses, tests
/admin/events/[id]/live                start / extend / end / health
/admin/events/[id]/submissions
/admin/events/[id]/submissions/[pid]
```

Server actions for mutations; route handlers for `/api/auth/[...path]`, `/api/run`, `/api/draft`, `/api/violation`, `/api/heartbeat`, `/api/figures`, `/api/figures/[id]/confirm`, `/api/figures/[id]`.

---

## 10. Failure handling

| Failure | Behaviour |
|---|---|
| Autosave request fails | Persistent "Not saved" banner; buffer mirrored to `localStorage`; resync on reconnect; local wins if newer |
| Participant refresh / crash | Resumes in the contest with the shared clock still running |
| Participant joins twice | Newest session wins; older goes read-only and is logged |
| Runner unavailable | Run returns 503; clock continues; organizer extends |
| Sandbox dies mid-run | Claim health-check replaces it; request retried once |
| Organizer broke a harness | Visible in the test panel; after `live` nothing can be edited, so the mitigation is the pre-event rehearsal |
| Deadline passes with the tab closed | Reconciled lockout with the last autosaved code |
| Bucket unconfigured | Statements render; the **Add figure** control is disabled with the reason; uploads are refused |
| Figure upload fails | Nothing is inserted; the pending row is swept on the next mint |
| Someone cannot sign in | No override. The roster is checked before Start; the pre-event instruction is to sign in once before arriving |

---

## 11. Non-goals

Leaderboard, automated scoring, plagiarism or AI detection, mobile participant UI, email notifications, event templates or cloning, multiple organizer roles, per-problem timers, partial credit, discussions, editor themes or vim mode, CSV export, devtools or second-device detection.

---

## 12. Build order

1. Schema, Neon Auth wiring, `ADMIN_EMAILS`, event + problem authoring, test panel.
2. Lobby, join code, shared clock, lockout reconciliation, terminal screen.
3. E2B template, sandbox pool, harness assembly, Run.
4. Anti-cheat: editor locks, strike recording, heartbeat, elimination, reinstate.
5. Review dashboard, shortlist, re-run.
6. Rehearsal: a full fake contest with three accounts, one deliberate elimination, one deliberate runner-limit test, one laptop-sleep test. Then one week of buffer before the real event.

---

## 13. Risks

- **E2B pool under a synchronized burst** — the only component with no local fallback. Mitigation: 20 warm sandboxes, claim queue, 20s bound, and a plan to run self-hosted Piston on a VPS if the pool proves unreliable in rehearsal.
- **False-positive strikes.** Alt-tab is genuinely accidental. Mitigation: dedupe window, visible counter, timestamped log, reinstate.
- **Monaco weight on a shared access point.** Mitigation: preload in the lobby.
- **Java cold start** eating the time limit. Mitigation: language-specific limits, and a warm JVM isn't attempted.
- **Harness authoring errors.** Mitigation: test panel plus rehearsal.
