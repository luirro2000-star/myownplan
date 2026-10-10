# Daylight product research

Reviewed 2026-10-10 from current product and help pages.

## What strong planning products do well

| Product | Useful pattern | Daylight response |
| --- | --- | --- |
| [Motion](https://www.usemotion.com/features/ai-task-manager) | Builds and continually updates a schedule from priorities, deadlines, and availability. | Keep the schedule as the primary product surface and use AI to interpret changes. |
| [Reclaim](https://reclaim.ai/features/planner) | Protects flexible focus time, habits, and tasks while automatically finding new times. | Preserve commitments and free time, and show proposed changes before applying them. |
| [Sunsama](https://help.sunsama.com/docs/getting-started/basics/daily-planning-the-basics/) | Uses a short daily planning ritual to review yesterday, choose today, and recognize overload. | Add a future guided start and shutdown flow without making routine use feel like a form. |
| [Akiflow](https://akiflow.com/features) | Makes capture and editing fast through a command bar and daily rituals. | Keep quick task entry and add intent shortcuts to the assistant. |
| [Structured](https://help.structured.app/en/articles/380546) | Opens on a visual daily timeline and uses simple mobile navigation plus a prominent add action. | Use a phone bottom bar, preserve the timeline as the home screen, and float the assistant within thumb reach. |
| [Tiimo](https://www.tiimoapp.com/product/visual-planning) | Reduces overwhelm with one visual view, visual timers, drag and drop, and AI task breakdown. | Keep one calm daily view and progressively reveal planning detail. |
| [ChatGPT Voice](https://help.openai.com/en/articles/20001274-chatgpt-voice) | Starts a spoken conversation from one control, sends speech turns without a separate Send tap, speaks responses, and supports interruption in its live mode. | Daylight now automatically sends completed speech turns and listens again after speaking. True simultaneous interruption needs a realtime audio service and remains future work. |

## Product direction

Daylight should feel like an adaptive daily plan with an assistant available when needed. The schedule, next action, capacity, and protected free time stay visible. AI handles ambiguous language, extracts intent, explains tradeoffs, and proposes changes. The deterministic planning engine remains responsible for applying reviewed changes.

The meaningful difference is **calm accuracy**:

- one trustworthy day view instead of a chat transcript as the product;
- free time and fixed commitments protected by explicit planning rules;
- learned suggestions require evidence and the user's acceptance;
- routine actions produce brief confirmation and durable History records;
- conversation is reserved for questions, explanations, and changes that need judgment;
- voice removes typing and the extra Send step while preserving review before schedule changes.

## Next research-backed opportunities

1. A two-minute morning check-in that confirms energy, hard commitments, and one priority.
2. A persistent **Now** card with quick **Done**, **Later**, and **Help me start** controls. The direct-action card is implemented; a lightweight timer remains optional future work.
3. Direct manipulation of flexible blocks on the timeline, followed by a rule and conflict check.
4. Realtime voice with interruption after provider, privacy, cost, and browser support are evaluated.
5. Physical-device testing with one-handed reach, microphone permission changes, interruptions, and poor connectivity.
