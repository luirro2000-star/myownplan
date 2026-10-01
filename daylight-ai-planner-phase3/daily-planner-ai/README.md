# Daylight — AI Daily Planner

Milestone 4 planner with conversation, local recovery, and an invite-only cloud sync flow on Netlify.

## What works now
- Today timeline with fixed and flexible blocks
- checkmarks and expandable routine subtasks
- Monday–Friday seed data based on the original planning example
- Week overview, Goals view, and new Inbox view
- local browser persistence with automatic migration from the Milestone 2 local state
- conversational Anthropic planner through a server-side Netlify Function
- structured AI change proposals
- deterministic scheduling engine beneath the AI
- fixed-vs-flexible constraint handling
- open-slot calculation and overlap prevention
- 15-minute school-arrival/prep buffers in the seed schedule
- weekday deadlines and task priority
- splittable flexible tasks with minimum block lengths
- protected free-time budgets per day
- daily capacity and overload diagnostics
- Reality Mode: replan forward from the current time
- planner change reports
- in-session undo for planner transactions
- brain-dump intake through a dedicated Anthropic endpoint
- multi-object extraction into events, tasks, routines, rules, goals, metrics, and open loops
- confidence-aware “Here’s what I understood” review before anything is applied
- ambiguous intake items start unchecked rather than being silently guessed
- editable intake type, title, day, time, and duration before application
- raw user wording retained in the Inbox capture history
- accepted brain-dump items flow into the deterministic scheduler
- offline heuristic intake fallback for local/static testing when the Anthropic endpoint is unavailable
- voice capture for Planner and Inbox in supporting browsers, with optional spoken replies
- Quick add task entry without AI, scheduled by the deterministic engine
- conversational follow-up context and specific AI connection errors
- persistent local undo history and manual JSON backup export/import
- invite-only Netlify Identity sign-in and account-scoped cloud data
- Netlify Database storage for the planner, Inbox, recent conversation, and 20 undo checkpoints
- revision checks that pause automatic sync when another device changed the plan
- explicit first-sync choice between the plan on this device and the cloud plan
- cloud copy deletion while retaining the plan on this device

## Product architecture
Claude interprets what the user means. It does not get final authority over time placement.

```text
Messy natural-language input
        ↓
Anthropic interpretation layer
        ↓
Reviewable typed objects
        ↓
User acceptance / correction
        ↓
Deterministic planner engine
        ↓
Feasible schedule + rules + goals + metrics + open loops
```

This separation is intentional. A sentence can remain a goal, rule, metric, or open loop instead of being forced into a calendar rectangle.

## Brain-dump workflow
Open **Inbox** and paste unstructured notes. The intake interpreter returns:
- fixed events
- flexible tasks
- routines
- planning rules
- goals
- numeric metrics
- open loops
- only material clarification questions

Nothing is applied immediately. Daylight shows a review screen first. Low-confidence/ambiguous items are unchecked by default. Once accepted, calendar-like items enter the scheduling engine and non-calendar items are stored in the appropriate planning layer.

## Local preview
Install dependencies, then build the frontend and serve `dist`.

```bash
npm ci
npm run build
python -m http.server 8080 --directory dist
```

Then open `http://localhost:8080`.

The planner engine, intake review UI, offline intake fallback, checkmarks, Reality Mode, week planning, undo, and local persistence work without the Anthropic API. Netlify Identity, cloud sync, and AI Functions require the deployed Netlify site.

## Anthropic setup on Netlify
Create this environment variable for Functions:

```text
ANTHROPIC_API_KEY=your_key_here
```

Optional:

```text
ANTHROPIC_MODEL=claude-sonnet-5-5
```

The API key never appears in frontend code. Both `/api/assistant` and `/api/intake` call Anthropic only from Netlify Functions.
If the provider rejects a request, Planner now shows the relevant error category instead of always saying the key is missing.

## Voice and data

Tap the microphone in Planner or Inbox to dictate. Review the transcript before sending it. Browser speech recognition may use the browser vendor's speech service; availability depends on the browser and microphone permission. Spoken replies are optional.

History keeps the last 20 planner undo checkpoints. Signed-in accounts also save the planner, Inbox, conversation, and undo history in Netlify Database. At first sign-in, Daylight asks whether to use the existing cloud plan or move this device’s plan to cloud. If two devices edit the same plan, automatic sync pauses for a choice. Use **Download backup** to save a JSON copy of planner data and history, or **Import backup** to restore one. Keep backups private. **Delete cloud copy** removes server data while leaving this device’s copy.

## Deployment

Netlify builds the Vite frontend to `dist` and deploys Functions from `netlify/functions`. The SQL migration in `netlify/database/migrations` creates the planner and snapshot tables. Enable Netlify Identity, set registration to **Invite only**, and invite the account owner. Database usage consumes Netlify credits while active; monitor the team balance. The two AI Functions require a signed-in account and keep `ANTHROPIC_API_KEY` on the server.

## Deploy to Netlify
1. Put this project in a Git repository and import it into Netlify.
2. The included `netlify.toml` sets `site` as the publish directory and `netlify/functions` as the Functions directory.
3. No frontend build command is required for this prototype.
4. Add `ANTHROPIC_API_KEY` in Netlify environment variables with Functions access.
5. Deploy.

## Current planner constraints
- Active planning window: 7:00 AM–10:30 PM.
- Protected free time defaults to 2h Mon–Wed, 3h Thu, and 5h Fri.
- School events in the seed data reserve a 15-minute arrival buffer.
- Deadlines are currently weekday-level rather than exact timestamps.
- Reviewed recurring routines are materialized into weekday instances; a persistent recurrence-rule engine comes later.
- The first Inbox stores capture history locally; cloud-backed long-term memory arrives with accounts/database work.

## Tests included
- `engine-smoke-test.mjs`
- `engine-regression-test.mjs`
- `intake-regression-test.mjs`

Run all tests with:

```bash
npm test
```

See `PHASE3_AUDIT.md` for the handoff audit and `MASTER_PLAN.md` for the roadmap.
See `PHASE4A_AUDIT.md` for the current checkpoint audit and its remaining limits.
