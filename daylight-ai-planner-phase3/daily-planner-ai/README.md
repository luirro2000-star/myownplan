# Daylight — AI Daily Planner

Milestone 3 prototype of a conversational daily planner designed for Netlify.

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

## Preview without installing anything
Serve the `site` folder with any static server.

```bash
python -m http.server 8080 --directory site
```

Then open `http://localhost:8080`.

The planner engine, intake review UI, offline intake fallback, checkmarks, Reality Mode, week planning, undo, and local persistence work without the Anthropic API. High-quality AI interpretation requires the Netlify Function endpoint.

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
