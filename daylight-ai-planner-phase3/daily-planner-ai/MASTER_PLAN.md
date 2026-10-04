# Daylight — Master Product & Implementation Plan

## Product thesis
Daylight is a conversational personal planning system. The user describes life in normal, messy language; the system identifies commitments, tasks, routines, goals, rules, dependencies, and uncertain intentions, then turns only the appropriate parts into a realistic schedule.

The central product rule is: **available time is not the same thing as time that should be filled.** Daylight must preserve free time and adapt the plan when reality changes.

---

## 1. Core object model

### Fixed event
A commitment whose time is externally constrained.
Examples: class, appointment, shift, meeting.

Core fields:
- title
- start/end
- location / travel buffer
- fixed = true
- source
- recurrence

### Flexible task
Something that must happen but can move.
Examples: homework, edit presentation, laundry.

Core fields:
- estimate
- deadline
- priority
- minimum useful block
- splittable
- preferred windows
- energy requirement
- dependencies

### Routine
A repeatable sequence, often represented as one expandable block.
Examples: morning routine, bedtime routine.

Core fields:
- recurrence
- duration estimate
- subtasks
- minimum / normal / full version

### Rule / preference
A constraint used by the planner but not rendered as a task.
Examples: arrive at school 15 minutes early; preserve Friday evening; no homework after 9 PM.

### Goal
An outcome that generates next actions instead of becoming a fake calendar event.
Examples: go to gym 3x/week; get an internship; improve portfolio.

### Metric
A numeric target with a time horizon.
Examples: 4,000 school points before leaving.

### Open loop
A vague but meaningful intention that has not yet become an actionable plan.
Examples: “I need to figure out my portfolio.”

### Dependency
Relationships between tasks and events.
Examples: finish deck → review deck → practice presentation → presentation.

---

## 2. Conversational interpretation layer
Claude's job is language understanding, not unconstrained scheduling.

Inputs:
- current planner state
- current time/day
- user message
- known preferences/rules
- relevant history

Outputs:
- concise conversational explanation
- typed proposed operations
- only materially necessary clarification questions

Supported operation families:
- create
- move
- update
- complete
- create rule
- create goal
- add dependency
- replan

Safety/product requirement:
- modifications are previewed before application by default
- low-risk automatic application can become an opt-in setting later
- every automated schedule change should be undoable

---

## 3. Deterministic planning engine
The scheduler should sit beneath the AI so time arithmetic remains predictable.

### Hard constraints
- fixed events
- deadlines
- sleep window
- unavailable periods
- mandatory buffers / travel
- dependency ordering

### Soft constraints
- preferred time of day
- energy level
- batching similar tasks
- preserving free time
- user's historical completion patterns
- avoiding fragmented blocks
- preferred gym timing

### Suggested priority order
1. Fixed commitments
2. Sleep and basic routines
3. Deadline-critical work
4. Required recurring responsibilities
5. Goal progress
6. Optional tasks
7. Explicitly preserved open time

### Scheduling capabilities
- locate a feasible open slot
- split splittable work
- detect overload
- detect impossible days
- move flexible tasks to nearby days
- calculate preparation/travel buffers
- prevent overlap
- protect minimum open-time allowance
- produce an explanation for each meaningful change

---

## 4. Main product surfaces

### Today
The home screen.
- chronological plan
- checkmarks
- collapsible routines
- fixed/flexible distinction
- completion status
- “Reality Mode”
- conversational input always accessible
- free-time indicator

### Week
- workload distribution
- fixed vs flexible time
- intentional open time
- weekly goal progress
- overloaded-day warning

### Goals
- weekly targets
- longer-term outcomes
- generated next actions
- open loops

### Inbox
Everything Daylight understood but has not fully resolved.
- ambiguous notes
- unscheduled tasks
- questions
- imported obligations

---

## 5. Signature workflows

### Brain-dump onboarding
Prompt: “Tell me what your life looks like right now. Don't organize it.”

Pipeline:
1. Parse into candidate objects.
2. Separate facts from inferred assumptions.
3. Identify material ambiguities.
4. Present “Here’s what I understood.”
5. User corrects only what matters.
6. Generate first realistic week.

### Reality Mode
Input examples:
- “Today went badly.”
- “I'm exhausted.”
- “It's 4 PM and I haven't started.”

Behavior:
1. Freeze the past.
2. Keep remaining fixed commitments.
3. identify urgent obligations.
4. reduce / defer flexible work.
5. preserve food, transition, and rest.
6. produce the best realistic remainder of the day.

### Minimum / Normal / Ambitious day
Routines and goals can expose three execution levels.
This allows a low-energy day to degrade gracefully instead of becoming a failed day.

### Goal decomposition
Vague outcome → milestones → next actions → feasible schedule blocks.
Only the current actionable layer enters the schedule.

---

## 6. Data architecture

### Phase 1
Browser localStorage for fast prototyping.

### Phase 2
Postgres backend (recommended: Supabase or Neon) with:
- users
- planner_items
- recurrences
- routines
- routine_steps
- goals
- rules
- metrics
- dependencies
- conversations
- planner_operations
- schedule_snapshots
- completion_history

Why a real database is required:
- multi-device sync
- history / undo
- behavioral learning
- calendar integrations
- recurrent objects
- analytics

---

## 7. Hosting / backend architecture

Phase 1 frontend:
- dependency-free HTML/CSS/JavaScript to keep the first handoff directly testable and Netlify-ready

Production frontend target after the planning engine is proven:
- React
- TypeScript
- Vite
- deploy on Netlify

Backend:
- Netlify Functions
- server-side Anthropic calls
- never expose API key to browser

Environment variables:
- ANTHROPIC_API_KEY
- ANTHROPIC_MODEL (optional; defaults to claude-sonnet-5-5 in prototype)
- later: DATABASE_URL, calendar credentials, etc.

---

## 8. Milestones

### Milestone 1 — Functional shell (COMPLETE)
Goal: prove the interaction model.

Deliverables:
- [x] Netlify-ready dependency-free functional prototype
- [x] Today timeline
- [x] checkable items
- [x] expandable morning routine
- [x] weekday switching
- [x] week overview
- [x] goals view
- [x] planning rules
- [x] local persistence
- [x] conversational panel
- [x] server-side Anthropic endpoint
- [x] structured AI proposals
- [x] Apply-change interaction
- [x] Reality Mode prompt

Not yet production complete:
- no account/authentication
- no cloud persistence
- no recurring-rule engine
- no mobile UI pass

### Milestone 2 — Real planner engine (CORE COMPLETE)
Goal: make the schedule trustworthy.

Deliverables:
- [x] open-slot calculation
- [x] overlap prevention
- [x] duration fields and time-derived durations
- [x] fixed vs flexible constraint solver
- [x] weekday deadlines
- [x] splittable tasks with minimum block size
- [x] generic prep/travel buffer support
- [~] recurring tasks/routines (seeded recurring instances work; recurrence-rule generation is later)
- [x] protected free time
- [x] daily capacity calculation
- [x] overload/conflict detection
- [x] schedule change report + in-session undo
- [x] AI proposes intent; scheduler decides feasible placement
- [x] Reality Mode replans forward from the current time
- [x] do not rewrite earlier weekdays when replanning from midweek
- [x] preserve an existing flexible block when it already fits

Remaining hardening before calling the engine production-ready:
- exact date/time deadlines instead of weekday-only deadlines
- multi-day splitting for very large tasks
- persistent undo/history across browser sessions
- dependency ordering in the solver
- travel-time calculation from locations rather than explicit buffers
- configurable planning rules through the UI/conversation

### Milestone 3 — Conversational onboarding + Inbox (CORE COMPLETE)
Goal: accept a life brain dump and build the system automatically.

Deliverables:
- [x] dedicated Brain Dump / Inbox surface
- [x] multi-object extraction from one message
- [x] event / task / routine / rule / goal / metric / open-loop classification
- [x] source wording retained alongside interpretations
- [x] confidence-aware ambiguity handling
- [x] ambiguous items unchecked by default
- [x] “Here’s what I understood” review screen
- [x] user can accept/reject and correct type/title/day/time/duration
- [x] rules extracted from natural language
- [x] goals, metrics, and open loops stored outside the calendar
- [x] reviewed time-based objects feed the deterministic scheduler
- [x] Inbox capture history
- [x] offline heuristic fallback for local testing

Remaining before the intake system is production-ready:
- richer correction controls for recurrence, deadlines, targets, and preferred windows
- persistent unresolved-question workflow instead of review-session-only questions
- duplicate detection against existing planner data
- semantic merging into existing routines (for example adding “make bed” as a step instead of creating another routine)
- true goal decomposition into milestones and next actions
- exact date parsing beyond the current Monday–Friday prototype horizon

### Milestone 4 — Persistence + accounts
Goal: make it usable every day.

Deliverables:
- Postgres
- authentication
- sync across devices
- operation history
- backups
- privacy controls

### Milestone 5 — Adaptive daily planning
Goal: make Daylight improve after real use.

Deliverables:
- actual vs estimated durations
- skipped-task patterns
- preferred time windows
- completion probability signals
- Minimum / Normal / Ambitious modes
- better duration recommendations
- explicit user controls for learned assumptions

### Milestone 6 — Calendar integration
Goal: stop duplicate entry.

Deliverables:
- Google Calendar import
- optional write-back to dedicated Daylight calendar
- free/busy awareness
- calendar conflict handling
- source-of-truth rules

### Milestone 7 — School / work integrations
Potential integrations:
- Canvas LMS
- email-derived deadlines with confirmation
- project/task platforms if useful

Imported data should enter an Inbox first unless confidence is extremely high.

### Milestone 8 — Notifications and proactive assistance
Goal: intervene only when useful.

Examples:
- leaving-time reminders
- a block no longer fits before the next commitment
- weekly goal is falling behind and a feasible window exists
- deadline risk
- schedule has become unrealistic

Avoid generic notification spam.

### Milestone 9 — Product polish / mobile
- responsive mobile-first Today screen
- installable PWA
- offline completion toggles
- fast capture
- voice input
- accessibility audit
- animation/haptics where appropriate

---

## 9. Product decisions to preserve throughout development
1. AI interprets; deterministic code schedules.
2. Not every goal becomes an event.
3. Free time is protected, not treated as unused capacity.
4. Ask only when ambiguity materially changes the outcome.
5. Plans should degrade gracefully when the day changes.
6. The app should explain meaningful schedule changes.
7. User remains in control of assumptions and learned preferences.
8. Undo/history is essential before automatic replanning becomes aggressive.
9. The interface should feel calmer as the user's life becomes more complicated, not denser.

---

## 10. Immediate next build target
Milestone 4: persistence, accounts, and durable planner history. The product can now ingest a messy life brain dump, let the user review what the AI understood, store non-calendar intentions in the correct layer, and schedule accepted time-based work through deterministic code.

The next build should replace local-only state with a durable backend foundation:
- authentication
- Postgres planner data
- cross-device sync
- persistent operation history and undo
- durable Inbox captures and unresolved questions
- schedule snapshots
- privacy/data controls
- migration path from local prototype data

Alongside that foundation, goal decomposition should become the first higher-level intelligence feature: vague goal → milestones → concrete next action → scheduler. External calendar integrations should follow after the app has a reliable source of truth.

### Checkpoint 4A — conversation and local recovery (implemented 2026-10-01)

- Voice capture for chat and Inbox where browser speech recognition is available, with transcript review before sending.
- Optional spoken responses.
- Recent conversation context for follow-up questions.
- Specific AI connection errors so setup failures can be diagnosed.
- Quick task entry without AI, scheduled through the deterministic engine.
- Persistent local undo history and manual JSON backup export/import.

These changes do not complete Milestone 4. The next checkpoint is authentication and a Postgres-backed source of truth for planner items, Inbox captures, operations, and snapshots, followed by migration from local data.

### Checkpoint 4B — accounts and cloud foundation (implemented locally 2026-10-01)

- Netlify Identity configured for invite-only registration. The account owner completes invitation acceptance and chooses a password.
- Netlify Database migration stores account-scoped planner state, Inbox captures, recent conversation, undo history, and the last 20 planner snapshots.
- The app gives an explicit choice when a local plan and cloud plan differ. Revision checks pause sync rather than silently overwriting another device’s work.
- JSON backup now includes history and conversation. Cloud deletion leaves the device copy intact.
- AI endpoints require sign-in, protecting the server-side API key from anonymous use.

Production deployment and owner account acceptance must be verified before marking this checkpoint complete. Subsequent work: server-side restoration of earlier snapshots, per-operation event history, persistent unresolved questions, then goal decomposition.

### Checkpoint 4C — durable Inbox review (implemented locally 2026-10-02)

- Each brain-dump capture now stores its review draft with the account-scoped planner state.
- Unapplied items remain in Inbox after a partial import and can be reopened after a refresh or cloud sync.
- Corrections to type, day, recurrence, due day, time, duration, goal target, unit, and planning notes are saved with the draft.
- Review item IDs are made unique before partial application, so applying one item cannot accidentally remove another.

The live site remains on checkpoint 4A to conserve production deploy credits. Checkpoint 4C passed remote unsigned preview testing; account-backed recovery awaits the owner account. Next: goal decomposition, followed by snapshot restoration and operation history.

### Checkpoint 4D — goal decomposition (implemented locally 2026-10-02)

- Goals and open loops can become editable roadmaps with two to four milestones and one small next action.
- Signed-in users can request an AI suggestion through a server-side, account-protected Function. Without sign-in or when AI is unavailable, an editable starter roadmap remains available.
- Saving a roadmap does not change the schedule. **Save & plan next step** passes the action to the deterministic planner, which protects fixed commitments and free time. Editing a linked action updates its planner task.
- Roadmaps live with their goal or open loop in local storage, backups, and account-scoped cloud state.

The draft pull request and Deploy Preview carry this checkpoint while production remains on 4A. Remote unsigned flow was checked; signed-in AI/sync verification awaits the owner account. Next: restore earlier server snapshots from History, then add per-operation history.

### Checkpoint 4E — server snapshot recovery (implemented locally 2026-10-02)

- Signed-in History can list the last 20 account-scoped server versions.
- Restoring a version creates a new current cloud revision in one database transaction, using an expected-revision check to protect changes made on another device.
- The current planner is saved in Undo before restoration. The user confirms the chosen version, then can undo the restoration.
- Cloud versions include the planner state; the current conversation remains intact. Existing cloud deletion removes both the planner and its snapshots through the database relationship.

The draft preview carries this checkpoint while production remains on 4A. Signed-in end-to-end recovery awaits the owner account. Next: per-operation history and persistent unresolved questions.

### Checkpoint 4F — planning memory (implemented locally 2026-10-02)

- Every Undo-backed planner action now adds a concise operation record with a timestamp and a summary of changed planner blocks, goals, open loops, rules, Inbox captures, or questions. The latest 100 records remain with the planner state and the latest 50 display in History.
- Assistant clarification questions persist in the planner state. Inbox presents pending questions with **Answer** and **Dismiss** actions. Answering opens the Planner composer, including its voice control, and resolves the question only after a successful reply.
- Inbox capture questions are visible from the Inbox even when the review is closed, with a direct path back to the related review item.
- The operation log and question list follow the existing local backup and account-scoped cloud sync flows.

Production remains on checkpoint 4A. The draft preview still needs signed-in question and sync checks after the owner account is available. Next: a release readiness pass across the full Milestone 4 feature set.

### Checkpoint 5A — daily planning intensity (implemented locally 2026-10-02)

- Today offers one-tap Minimum, Normal, and Ambitious modes per weekday.
- Minimum reserves three additional hours, Normal one additional hour, and Ambitious uses the existing protected-free-time target. All modes preserve the user's configured free-time floor and leave fixed commitments anchored.
- Choosing a mode replans flexible work through the deterministic scheduler, saves the choice in local/cloud planner state and backups, and creates an Undo point and operation record.

This is the first Milestone 5 checkpoint. Actual-vs-estimated durations, skip patterns, learned preferences, and explicit controls for those assumptions remain future checkpoints.

### Checkpoint 5B — observed work (implemented locally 2026-10-02)

- Finishing flexible work records its estimate and an actual duration. The user can correct actual time with a short menu, without typing.
- A flexible block can be skipped and later brought back. Skipped blocks are excluded from scheduling and capacity calculations until restored.
- Recent completion and skip records appear in History and are saved with local planner state, backups, and cloud sync. Undo reverses these changes.
- The app collects observations without silently changing future task estimates.

Next: summarize recurring duration and skip patterns, then let the user explicitly accept or reject a suggested estimate or preferred window.

### Checkpoint 5C — user-controlled duration suggestions (implemented locally 2026-10-02)

- After at least two completed blocks with the same title, Daylight uses the median of up to ten recent actual durations to suggest a revised estimate when it differs materially from the current one.
- A suggestion is visible on an unfinished flexible block. **Use** updates only that block and reruns deterministic planning; **Ignore this suggestion** suppresses the same suggestion until restored from History.
- Accepted and ignored choices persist with local planner state, backups, and cloud sync. Undo applies to either choice.
- No estimate changes automatically. Preferred-window learning and completion probability remain later work.

### Checkpoint 5D — work patterns and time preferences (implemented locally 2026-10-03)

- Recent attempts with the same title produce a simple finished/skipped count after at least three records. The display uses up to ten attempts and does not claim a reliable success probability.
- Completed records retain their scheduled start time. Three or more matching completed blocks in the same broad time band may generate an optional preferred-window suggestion. Skips do not count as positive evidence for a window.
- **Prefer morning/afternoon/evening** applies the window only to the chosen unfinished flexible block, then runs deterministic planning. **Ignore this suggestion** persists until **Show again** in History. Undo covers both actions.
- Scheduled start time is not evidence of when work actually began. Calendar dates, recurrence, and stronger adaptive signals remain later work.

### Checkpoint 9A — mobile readability and touch controls (implemented locally 2026-10-03)

- On narrow screens, the account form starts in a compact Cloud sync disclosure so the day is closer to the top. Invitation acceptance and unresolved cloud choices still open the disclosure.
- The phone layout increases tap areas and text sizes for navigation, weekday tabs, day modes, quick task entry, work actions, checkmarks, routine steps, and voice/chat controls.
- Completed and skipped blocks use higher contrast. This is an early mobile pass; installability, offline behavior, device testing, and a full accessibility audit remain later work.

### Checkpoint 4G — AI endpoint safeguards (implemented locally 2026-10-03)

- Assistant and brain-dump AI requests now use the same signed-in origin check already used by goal breakdown and cloud write operations.
- Both endpoints reject oversized request bodies before parsing and sending data to the AI provider. The assistant message and brain-dump text also have explicit length limits.
- Account sign-in and an actual provider request are still required to verify that the live preview's AI connection succeeds end to end.

### Checkpoint 4H — invitation sign-in (verified on preview 2026-10-04)

- Invitation acceptance now completes a normal sign-in so Netlify Functions receive the Identity cookie needed for account-scoped requests.
- The invited owner signed in and Daylight displayed “Synced across your devices.” The session survived a full page reload.
- Production remains on checkpoint 4A while the draft preview is audited.

### Checkpoint 4I — cloud comparison (verified on preview 2026-10-04)

- Cloud data is compared by content, ignoring PostgreSQL JSONB object-key order. A reload no longer raises a false local-versus-cloud choice.
- The comparison covers planner state, Undo history, and conversation. Actual differences still require an explicit choice.
- A temporary task saved as cloud version 2; Undo removed it and saved version 3. The owner plan no longer contains the test task.
- A live AI-provider request and server snapshot restoration remain to be checked before production release.
